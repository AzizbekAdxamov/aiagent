import prisma from "@/lib/prisma";

/**
 * MENTALABA AUTH (BOSQICH 1):
 * Foydalanuvchi mentalaba.uz saytida login qiladi → frontend token'ni
 * `Authorization: Bearer <token>` header orqali chat API'ga yuboradi.
 *
 * Bu modul:
 *   1. JWT token'ni decode qiladi (id, exp)
 *   2. User mentalaba_users jadvaliga yoziladi (id = mentalaba user id)
 *   3. Token muddati o'tgan bo'lsa — /v1/auth/refresh orqali avtomatik yangilanadi
 *
 * DIQQAT: frontenddan kelgan userId ga ishonilmaydi — user id TOKEN'DAN olinadi.
 */

const API_URL = process.env.MENTALABA_API_URL || "https://api.mentalaba.uz/v1";

// Lokal ishlab chiqish/test uchun auth'ni o'chirish (production'da YO'Q bo'lishi kerak!)
const AUTH_DISABLED = ["1", "true", "yes", "off"].includes(
  (process.env.MENTALABA_AUTH_DISABLED || "").toLowerCase()
);

export interface AuthUser {
  userId: number; // Mentalaba user id (JWT payload: id)
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
}

/** JWT payload'ni decode qiladi (verification qilmasdan — Mentalaba API o'zi tekshiradi) */
export function decodeJwt(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
    // base64url → utf8
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Request'dan Bearer token'ni ajratib oladi */
export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Request'dan refresh tokenni ajratib oladi (X-Refresh-Token header).
 * Frontend (chat-store) login paytida olingan refresh tokenni shu header'da
 * yuboradi — backend uni DB'ga saqlaydi, token eskirganda /v1/auth/refresh
 * orqali yangilay oladi. Shunday qilib har user o'z zanjirini yurgizadi.
 */
export function extractRefreshToken(request: Request): string | null {
  const header = request.headers.get("x-refresh-token") || "";
  return header.trim() || null;
}

/**
 * POST /v1/auth/refresh — refresh token orqali yangi access token olish.
 * Swagger: body { refreshToken } → { accessToken, refreshToken }
 */
export async function refreshUserTokens(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken?: string } | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      console.warn(`[Auth Refresh] ${res.status} — refresh token ham eskirgan bo'lishi mumkin`);
      return null;
    }
    const raw = await res.text();
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
    // Javob turlicha bo'lishi mumkin: {accessToken} | {data:{...}} | {token}
    const body = data?.data && typeof data.data === "object" ? data.data : data;
    const accessToken = body?.accessToken || body?.access_token || body?.token || body?.bearerToken;
    const newRefresh = body?.refreshToken || body?.refresh_token || refreshToken;
    if (!accessToken) return null;
    return { accessToken, refreshToken: newRefresh };
  } catch (error) {
    console.error("[Auth Refresh Error]", (error as Error).message);
    return null;
  }
}

/**
 * Request'dan autentifikatsiya qilingan user'ni aniqlaydi.
 * - Token yo'q / yaroqsiz → null (401)
 * - Token muddati o'tgan → refresh orqali yangilanadi (DB'ga yoziladi)
 * - Token to'g'ri → mentalaba_users'ga upsert qilinadi, AuthUser qaytariladi
 *
 * AUTH_DISABLED rejimida (lokal test) → null qaytaradi, lekin auth talab qilinmaydi.
 */
export async function getAuthUser(request: Request): Promise<AuthUser | null> {
  const token = extractBearerToken(request);
  if (!token) return null;

  const payload = decodeJwt(token);
  const userId = payload?.id ? Number(payload.id) : null;
  if (!userId) return null;

  const now = Date.now();
  const expMs = payload?.exp ? payload.exp * 1000 : 0;
  const isExpired = expMs > 0 && expMs < now;

  let accessToken = token;
  // YANGI (Fix): frontend X-Refresh-Token header'ida refresh tokenni yuboradi —
  // birinchi so'rovda DB'ga saqlanadi. Keyingi so'rovlarda DB'dagi ishlatiladi.
  // MUHIM (reviewer fix): DB'dagi refresh HEADER'dagidan ustun — chunki header
  // eskirgan (aylanib qolgan) bo'lishi mumkin, DB'dagi esa har doim yangi.
  const headerRefresh = extractRefreshToken(request) || null;
  let refreshToken: string | null | undefined = null;
  let tokenExpiresAt: Date | null = expMs ? new Date(expMs) : null;

  // DB'dan mavjud user'ni o'qiymiz (refresh tokeni eslab qolinadi)
  const existing = await prisma.mentalabaUser.findUnique({ where: { id: userId } });
  if (existing) {
    // DB'dagi refresh ustun; yo'q bo'lsa (yangi qurilma) header'dagi ishlatiladi
    refreshToken = existing.refreshToken || headerRefresh;

    // ===== TOKEN VALIDATSIYA (Fix: multi-device qo'llab-quvvatlash) =====
    // JWT signature bizda tekshirilmaydi (secret yo'q), shuning uchun token
    // haqiqiyligini tekshirish kerak. Lekin user 2-QURILMADA login qilganda
    // yangi token oladi — DB'dagi eskidan farq qiladi. Shuning uchun hard-
    // reject EMAS: mismatch bo'lsa API orqali validatsiya qilinadi. API token'ni
    // tasdiqlasa — DB yangilanadi va qabul qilinadi. API rad etsa — soxta token.
    const isKnownToken = !isExpired && existing.accessToken && existing.accessToken === token;
    if (!isKnownToken && !isExpired) {
      const profile = await validateTokenWithApi(token);
      if (!profile) {
        console.warn(`[Auth] User ${userId} tokeni validatsiyadan o'tmadi — soxta/eskirgan token`);
        return null;
      }
      const apiUserId = Number(profile?.id ?? profile?.user?.id);
      if (!apiUserId || !Number.isFinite(apiUserId) || apiUserId !== userId) {
        console.warn(`[Auth] User id mos emas: JWT=${userId}, API=${apiUserId}`);
        return null;
      }
      // Yangi qurilma tokeni tasdiqlandi → DB'ga yangi token yoziladi (keyingi tekshiruv tez)
      accessToken = token;
    }
    // DB'dagi token hali ham ishlaydimi — faqat exp tekshiramiz
    if (!isExpired && existing.accessToken && existing.accessToken === accessToken) {
      tokenExpiresAt = existing.tokenExpiresAt;
    }
  } else {
    // YANGI user (DB'da yo'q): refresh faqat header'dan olinadi
    refreshToken = headerRefresh;
    // JWT payload'ini soxtalashtirish mumkinligi uchun (signature secret
    // bizda yo'q) — tokenni Mentalaba API orqali validatsiya qilamiz.
    // DIQQAT (production test): /v1/users/profile javobida `id` YO'Q —
    // faqat { first_name, phone, email, ... } qaytadi. Shuning uchun
    // id bo'lmasa phone bilan solishtiriladi (JWT'da ham phone bor).
    const profile = await validateTokenWithApi(token);
    if (!profile) {
      console.warn(`[Auth] Yangi user ${userId} tokeni API validatsiyadan o'tmadi — soxta token`);
      return null;
    }
    const apiUserId = Number(profile?.id ?? profile?.user?.id);
    const profilePhone = String(profile?.phone ?? profile?.user?.phone ?? "");
    const jwtPhone = String(payload?.phone ?? "");
    // id bor bo'lsa — id bilan; id bo'lmasa — phone bilan tekshiramiz
    if (apiUserId && Number.isFinite(apiUserId) && apiUserId !== userId) {
      console.warn(`[Auth] User id mos emas: JWT=${userId}, API=${apiUserId}`);
      return null;
    }
    if (
      !apiUserId &&
      (!jwtPhone || !profilePhone || jwtPhone.replace(/\D/g, "") !== profilePhone.replace(/\D/g, ""))
    ) {
      console.warn(`[Auth] User phone mos emas: JWT=${jwtPhone}, API=${profilePhone}`);
      return null;
    }
  }

  // Token muddati o'tgan → refresh qilamiz
  if (isExpired) {
    const refreshSource = refreshToken || undefined;
    if (!refreshSource) {
      console.warn(`[Auth] User ${userId} tokeni muddati o'tgan, refresh token yo'q`);
      return null;
    }
    const refreshed = await refreshUserTokens(refreshSource);
    if (!refreshed) return null;
    accessToken = refreshed.accessToken;
    refreshToken = refreshed.refreshToken || refreshSource;
    const newPayload = decodeJwt(accessToken);
    tokenExpiresAt = newPayload?.exp ? new Date(newPayload.exp * 1000) : null;
  }

  // User'ni DB'ga yozamiz (yangilangan tokenlar bilan)
  await prisma.mentalabaUser.upsert({
    where: { id: userId },
    update: {
      accessToken,
      refreshToken: refreshToken ?? null,
      tokenExpiresAt,
    },
    create: {
      id: userId,
      accessToken,
      refreshToken: refreshToken ?? null,
      tokenExpiresAt,
    },
  });

  return { userId, accessToken, refreshToken, tokenExpiresAt };
}

/**
 * Token'ni Mentalaba API orqali validatsiya qiladi.
 * GET /v1/users/profile — Authorization header talab qiladi, 401 qaytarsa
 * token yaroqsiz. Yangi user'lar (DB'da yo'q) uchun chaqiriladi — mavjud
 * user'lar DB solishtirish orqali tekshiriladi (tez, qo'shimcha API yo'q).
 */
export async function validateTokenWithApi(token: string): Promise<any | null> {
  try {
    const res = await fetch(`${API_URL}/users/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const raw = await res.text();
    try {
      const data = JSON.parse(raw);
      // Javob shakli: { id, phone } | { data: {...} } | { user: {...} }
      return data?.data && typeof data.data === "object" ? data.data : data;
    } catch {
      return null;
    }
  } catch (error) {
    console.error("[Auth Validate Error]", (error as Error).message);
    return null;
  }
}

/** Auth talab qilinadimi (AUTH_DISABLED bo'lmasa) */
export function isAuthRequired(): boolean {
  return !AUTH_DISABLED;
}

/**
 * User tokeni API so'rovida 401 bo'lib, yangilanganda chaqiriladi.
 * Chat route bu handler'ni o'rnatadi — yangi tokenlar DB'ga yoziladi.
 */
export async function persistRefreshedUserTokens(
  userId: number,
  accessToken: string,
  refreshToken?: string | null
): Promise<void> {
  try {
    const payload = decodeJwt(accessToken);
    const exp = payload?.exp ? new Date(payload.exp * 1000) : null;
    await prisma.mentalabaUser.upsert({
      where: { id: userId },
      update: { accessToken, refreshToken: refreshToken ?? null, tokenExpiresAt: exp },
      create: { id: userId, accessToken, refreshToken: refreshToken ?? null, tokenExpiresAt: exp },
    });
  } catch (error) {
    console.error("[Auth Persist Tokens Error]", (error as Error).message);
  }
}
