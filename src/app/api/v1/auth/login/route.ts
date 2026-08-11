import { NextRequest, NextResponse } from "next/server";
import { mentalabaAuthPost, extractAuthTokens } from "@/lib/mentalaba-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/login
 * Chat ichida login: telefon + parol → mentalaba `/v1/auth/user/login` ga
 * server-to-server chaqiradi → token + refreshToken qaytaradi.
 * Frontend tokenlarni o'z localStorage'iga saqlaydi (chat domenida).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const phone = String(body?.phone || "").replace(/\s+/g, "");
    const password = String(body?.password || "");

    if (!phone || !password) {
      return NextResponse.json(
        { success: false, error: "Telefon raqam va parol kiriting" },
        { status: 400 }
      );
    }

    const result = await mentalabaAuthPost("/v1/auth/user/login", { phone, password });

    // Muvaffaqiyatli login → tokenlarni ajratib olamiz
    if (result.ok) {
      const tokens = extractAuthTokens(result.data);
      if (tokens) {
        return NextResponse.json({
          success: true,
          data: {
            token: tokens.token,
            refreshToken: tokens.refreshToken || null,
          },
        });
      }
      // Token topilmasa — API javobini qaytaramiz (debug uchun)
      return NextResponse.json(
        { success: false, error: result.message || "Noto'g'ri javob — keyinroq urinib ko'ring" },
        { status: 502 }
      );
    }

    // Xato: "You are not registered" | "Invalid password" | ...
    const message =
      result.message ||
      (result.status === 401
        ? "Telefon raqam yoki parol noto'g'ri"
        : "Login amalga oshmadi — keyinroq urinib ko'ring");

    const status = result.status === 401 || result.status === 415 ? 401 : result.status || 400;
    return NextResponse.json({ success: false, error: message }, { status });
  } catch (error) {
    console.error("[Auth Login Error]", error);
    return NextResponse.json(
      { success: false, error: "Xizmatda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}
