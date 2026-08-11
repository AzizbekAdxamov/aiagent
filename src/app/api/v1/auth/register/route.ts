import { NextRequest, NextResponse } from "next/server";
import { mentalabaAuthPost } from "@/lib/mentalaba-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/register
 * Chat ichida ro'yxatdan o'tish: ism + telefon + parol → mentalaba
 * `/v2/auth/register` ga chaqiradi → SMS tasdiqlash kodi yuboriladi.
 * Keyingi qadam: POST /api/v1/auth/verify (kod bilan).
 *
 * register_type: "phone" (SMS) | "whatsapp" (WhatsApp kod) — default "phone"
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const first_name = String(body?.first_name || "").trim();
    const phone = String(body?.phone || "").replace(/\s+/g, "");
    const password = String(body?.password || "");
    const register_type = body?.register_type === "whatsapp" ? "whatsapp" : "phone";
    const ref = body?.ref ? String(body.ref) : undefined;

    if (!first_name || !phone || !password) {
      return NextResponse.json(
        { success: false, error: "Ism, telefon raqam va parolni kiriting" },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Parol kamida 8 ta belgidan iborat bo'lishi kerak" },
        { status: 400 }
      );
    }

    const payload: Record<string, unknown> = {
      first_name,
      phone,
      password,
      register_type,
    };
    // ref ixtiyoriy — mavjud bo'lgandagina yuboriladi (sayt kodi kabi)
    if (ref) payload.ref = ref;

    const result = await mentalabaAuthPost("/v2/auth/register", payload);

    if (result.ok) {
      // Register muvaffaqiyatli → SMS kod yuborildi → verify bosqichiga o'tamiz
      return NextResponse.json({
        success: true,
        data: { phone, verifyRequired: true },
      });
    }

    const message =
      result.message ||
      (result.status === 409
        ? "Bu raqam allaqachon ro'yxatdan o'tgan — kirish tugmasini bosing"
        : "Ro'yxatdan o'tish amalga oshmadi — raqamni tekshirib qayta urinib ko'ring");

    const status = result.status === 409 ? 409 : result.status || 400;
    return NextResponse.json({ success: false, error: message }, { status });
  } catch (error) {
    console.error("[Auth Register Error]", error);
    return NextResponse.json(
      { success: false, error: "Xizmatda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}
