import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
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
