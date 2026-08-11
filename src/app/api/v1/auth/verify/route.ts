import { NextRequest, NextResponse } from "next/server";
import { mentalabaAuthPost, extractAuthTokens } from "@/lib/mentalaba-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/verify
 * SMS tasdiqlash kodi bilan ro'yxatdan o'tishni yakunlash.
 * mentalaba `/v2/auth/verify` → { code, phone } → javobda token + refreshToken
 * qaytadi — foydalanuvchi darhol tizimga kirgan bo'ladi.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const phone = String(body?.phone || "").replace(/\s+/g, "");
    const code = String(body?.code || "").replace(/\s+/g, "");

    if (!phone || !code) {
      return NextResponse.json(
        { success: false, error: "Telefon raqam va tasdiqlash kodini kiriting" },
        { status: 400 }
      );
    }

    const result = await mentalabaAuthPost("/v2/auth/verify", {
      code: Number(code),
      phone,
    });

    if (result.ok) {
      const tokens = extractAuthTokens(result.data);
      if (tokens) {
        return NextResponse.json({
          success: true,
          data: {
            token: tokens.token,
            refreshToken: tokens.refreshToken || null,
            firstName: result.data?.first_name || result.data?.data?.first_name || null,
          },
        });
      }
      return NextResponse.json(
        { success: false, error: "Noto'g'ri javob — keyinroq urinib ko'ring" },
        { status: 502 }
      );
    }

    const message =
      result.message ||
      (result.status === 400 ? "Tasdiqlash kodi noto'g'ri" : "Tasdiqlash amalga oshmadi");
    const status = result.status || 400;
    return NextResponse.json({ success: false, error: message }, { status });
  } catch (error) {
    console.error("[Auth Verify Error]", error);
    return NextResponse.json(
      { success: false, error: "Xizmatda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}
