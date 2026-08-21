import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser, extractGuestId } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // ===== AUTH (BOSQICH 1 + GUEST REJIM) =====
    // Login qilgan → userId; login qilmagan (guest) → guestId. Ikkalasi ham
    // feedback bera oladi, lekin faqat O'Z session'iga (izolyatsiya).
    const authUser = await getAuthUser(request);
    const guestId = extractGuestId(request);
    const userId = authUser?.userId ?? null;

    const body = await request.json();
    const { messageId, sessionId, rating, comment } = body;

    if (!messageId || !sessionId || ![1, -1].includes(Number(rating))) {
      return NextResponse.json(
        { success: false, error: "messageId, sessionId and rating are required" },
        { status: 400 }
      );
    }

    // MUHIM (security fix): userId ham, guestId ham bo'lmasa filter
    // `undefined` bo'lib, Prisma buni "cheklovsiz" deb tushunardi — har kim
    // boshqa foydalanuvchining session'iga feedback qoldira olardi. Endi
    // ikkalasi ham yo'q bo'lsa so'rov butunlay rad etiladi (fail-closed).
    if (!userId && !guestId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const message = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        sessionId,
        role: "assistant",
        // User/guest faqat O'Z session'iga feedback bera oladi
        session: userId ? { userId } : { guestId: guestId as string },
      },
      select: { id: true },
    });

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Assistant message not found" },
        { status: 404 }
      );
    }

    const feedback = await prisma.chatFeedback.create({
      data: {
        messageId,
        sessionId,
        rating: Number(rating),
        comment: typeof comment === "string" ? comment.slice(0, 1000) : null,
      },
    });

    return NextResponse.json({ success: true, data: feedback });
  } catch (error) {
    console.error("[Chat Feedback Error]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
