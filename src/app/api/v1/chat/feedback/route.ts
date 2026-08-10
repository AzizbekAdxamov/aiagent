import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser, isAuthRequired } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // ===== AUTH (BOSQICH 1) =====
    const authUser = await getAuthUser(request);
    if (isAuthRequired() && !authUser) {
      return NextResponse.json(
        { success: false, error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }
    const userId = authUser?.userId ?? null;

    const body = await request.json();
    const { messageId, sessionId, rating, comment } = body;

    if (!messageId || !sessionId || ![1, -1].includes(Number(rating))) {
      return NextResponse.json(
        { success: false, error: "messageId, sessionId and rating are required" },
        { status: 400 }
      );
    }

    const message = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        sessionId,
        role: "assistant",
        // User faqat O'Z session'iga feedback bera oladi
        session: userId ? { userId } : undefined,
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
