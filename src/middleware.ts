import { NextRequest, NextResponse } from "next/server";

/**
 * CORS MIDDLEWARE (FRONTEND/BACKEND BO'LINISHI)
 * ----------------------------------------------
 * Frontend (ai_front) alohida domenda yashaydi — backend API'ga boshqa
 * domendan chaqiradi. Shu middleware barcha /api/* so'rovlariga CORS
 * header'larini qo'shadi va OPTIONS (preflight) so'rovlariga javob beradi.
 *
 * Ruxsat etilgan domenlar:
 *   - Sukut bo'yicha: localhost:3001 (frontend dev), localhost:3000 (eski),
 *     https://aiagent-sand.vercel.app (hozirgi Vercel)
 *   - Qo'shimcha: CORS_ALLOWED_ORIGINS env o'zgaruvchisi (vergul bilan)
 *     Masalan: CORS_ALLOWED_ORIGINS=https://ai.mentalaba.uz,https://mentalaba.uz
 */
const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  // Vercel: backend va frontend deploy manzillari
  "https://aiagent-13wv-steel.vercel.app",
  "https://ai-front-taupe.vercel.app",
];

function getAllowedOrigins(): string[] {
  const extra = process.env.CORS_ALLOWED_ORIGINS;
  if (extra) {
    const fromEnv = extra
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return [...new Set([...DEFAULT_ORIGINS, ...fromEnv])];
  }
  return DEFAULT_ORIGINS;
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  const allowed = getAllowedOrigins();
  const corsOrigin = allowed.includes(origin) ? origin : null;

  // Preflight (OPTIONS) so'rovlariga tez javob
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin || "",
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-Refresh-Token, X-Guest-Id",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
      },
    });
  }

  const response = NextResponse.next();
  if (corsOrigin) {
    response.headers.set("Access-Control-Allow-Origin", corsOrigin);
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Refresh-Token, X-Guest-Id"
    );
    // Origin'ga qarab o'zgaruvchi header — CDN/cache noto'g'ri CORS
    // yozmasligi uchun Vary: Origin majburiy
    response.headers.set("Vary", "Origin");
  }
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
