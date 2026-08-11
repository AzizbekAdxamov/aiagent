import { NextRequest, NextResponse } from "next/server";
import { mentalabaAuthPost } from "@/lib/mentalaba-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/resend-code
 * Tasdiqlash kodini qayta yuborish (yoki yangi ro'yxatdan o'tishda SMS).
 * mentalaba `/v2/auth/resendVerifyCode` → { phone, type: "register", register_type }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const phone = String(body?.phone || "").replace(/\s+/g, "");
    const register_type = body?.register_type === "whatsapp" ? "whatsapp" : "phone";

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Telefon raqamni kiriting" },
        { status: 400 }
      );
    }

    const result = await mentalabaAuthPost("/v2/auth/resendVerifyCode", {
      phone,
      type: "register",
      register_type,
    });

    if (result.ok) {
      return NextResponse.json({
        success: true,
        data: { sent: true, phone },
      });
    }

    const message = result.message || "Kodni qayta yuborib bo'lmadi — keyinroq urinib ko'ring";
    const status = result.status || 400;
    return NextResponse.json({ success: false, error: message }, { status });
  } catch (error) {
    console.error("[Auth Resend Error]", error);
    return NextResponse.json(
      { success: false, error: "Xizmatda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}
