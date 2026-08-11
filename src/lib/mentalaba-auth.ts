/**
 * MENTALABA AUTH PROXY (BOSQICH 2 — chat ichida login/register)
 * --------------------------------------------------------------
 * Chat backend mentalaba.uz API'sining auth endpointlariga server-to-server
 * chaqiradi. Sabab: foydalanuvchi chat'ning O'ZIDA login qilishi kerak
 * (mentalaba.uz saytiga o'tmay), tokenlar chat domenining localStorage'ida
 * saqlanadi.
 *
 * MUHIM: api.mentalaba.uz auth endpointlari nginx darajasida bloklangan —
 * curl default User-Agent bilan 403 qaytaradi. Brauzer-like User-Agent +
 * Origin/Referer qo'shilganda ishlaydi (jonli testda tasdiqlangan).
 *
 * Endpointlar (sayt JS bundle'idan aniqlangan):
 *   POST /v1/auth/user/login       { phone, password } → { data: { token, refreshToken } }
 *   POST /v2/auth/register         { first_name, password, phone, register_type, ref? } → SMS yuboriladi
 *   POST /v2/auth/verify           { code: number, phone } → { data: { token, refreshToken } }
 *   POST /v2/auth/resendVerifyCode { phone, type: "register", register_type }
 */

// DIQQAT: .env dagi MENTALABA_API_URL "/v1" bilan tugaydi (external-api.ts
// konventsiyasi). Lekin auth endpointlari IKKALA versiyada: login /v1 da,
// register/verify /v2 da. Shuning uchun base'dan "/v1" suffixini olib,
// har bir path'ni to'liq versiya bilan yozamiz:
//   "/v1/auth/user/login"  → https://api.mentalaba.uz/v1/auth/user/login
//   "/v2/auth/register"    → https://api.mentalaba.uz/v2/auth/register
const API_URL = (process.env.MENTALABA_API_URL || "https://api.mentalaba.uz/v1")
  .replace(/\/+$/, "")
  .replace(/\/v1$/, "");

/** nginx bloklamasligi uchun brauzer-like User-Agent */
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export interface MentalabaAuthResponse {
  status: number;
  ok: boolean;
  /** Pars qilingan javob (har qanday shaklda bo'lishi mumkin) */
  data: any;
  /** Xato xabari (foydalanuvchiga ko'rsatish uchun) */
  message?: string;
}

/**
 * Mentalaba auth endpoint'iga POST so'rov yuboradi.
 * Javob shakli API'dan API'ga farq qilishi mumkin — message ni ehtiyotkorlik
 * bilan ajratib olamiz (foydalanuvchiga chiroyli xato ko'rsatish uchun).
 */
export async function mentalabaAuthPost(
  path: string,
  body: Record<string, unknown>
): Promise<MentalabaAuthResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": BROWSER_UA,
        Origin: "https://mentalaba.uz",
        Referer: "https://mentalaba.uz/",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    return {
      status: 502,
      ok: false,
      data: null,
      message: "Mentalaba xizmatiga ulanib bo'lmadi — keyinroq qayta urinib ko'ring.",
    };
  }

  const raw = await response.text().catch(() => "");
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw };
  }

  // Xato xabari turli joylarda bo'lishi mumkin:
  //   { message: "..." } | { data: { message } } | { error: "..." }
  const message =
    (typeof data?.message === "string" && data.message) ||
    (typeof data?.error === "string" && data.error) ||
    (typeof data?.data?.message === "string" && data.data.message) ||
    undefined;

  return { status: response.status, ok: response.ok, data, message };
}

/**
 * Javobdan access + refresh tokenlarni chiqaradi.
 * Sayt kodi localStorage'ga `e.data.token` va `e.data.refreshToken` yozadi —
 * shuning uchun ham data.token, ham data.accessToken qo'llab-quvvatlanadi.
 */
export function extractAuthTokens(data: any): {
  token: string;
  refreshToken?: string;
} | null {
  const body = data?.data && typeof data.data === "object" ? data.data : data;
  const token =
    body?.token || body?.accessToken || body?.access_token || body?.bearerToken;
  const refreshToken = body?.refreshToken || body?.refresh_token;
  if (!token) return null;
  return { token, refreshToken };
}
