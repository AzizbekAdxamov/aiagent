import { NextRequest, NextResponse } from "next/server";
import { llmService } from "@/ai-agent/llm-service";
import { intentClassifier } from "@/ai-agent/intent-classifier";
import prisma from "@/lib/prisma";
import { sanitizeText } from "@/lib/sanitize-text";
import type { ChatMessage, SessionContext } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionId, language = "uz" } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    // Get or create session
    let session;
    if (sessionId) {
      session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
    }

    if (!session) {
      // Detect intent for session title
      const intent = intentClassifier.classify(message);
      session = await prisma.chatSession.create({
        data: {
          title: message.substring(0, 100),
          language,
        },
        include: { messages: true },
      });
    }

    // Save user message
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: message,
      },
    });

    // Build session context (metadata dan currentTopicName va keyingi follow-up ma'lumotlarini yuklash)
    const metadata = (session.metadata || {}) as Record<string, any>;
    const sessionContext: SessionContext = {
      language: (session.language || "uz") as "uz" | "ru" | "en",
      currentUniversityId: session.currentUniversityId ?? undefined,
      currentDirectionId: session.currentDirectionId ?? undefined,
      currentTopicName: metadata.currentTopicName as string | undefined,
      currentRegion: metadata.currentRegion as string | undefined,
      currentDirectionCategory: metadata.currentDirectionCategory as string | undefined,
      currentInstitutionCategory: metadata.currentInstitutionCategory as string | undefined,
      interestGrant: metadata.interestGrant as boolean | undefined,
      currentDegree: metadata.currentDegree as string | undefined,
      currentLanguage: metadata.currentLanguage as string | undefined,
    };

    // Get conversation history
    const conversationHistory: ChatMessage[] = session.messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      intent: m.intent ?? undefined,
      selectedTool: m.selectedTool ?? undefined,
      toolResults: m.toolResults ?? undefined,
      timestamp: m.createdAt,
    }));

    // Generate AI response
    const response = await llmService.generateResponse(
      message,
      sessionContext,
      conversationHistory,
      language
    );

    // Save and sanitize AI response
    const sanitizedContent = sanitizeText(response.content || '');
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: sanitizedContent,
        intent: response.intent,
        selectedTool: response.toolUsed,
      },
    });

    // Extract topic name from response for follow-up detection
    // Single university: ## ðŸ› University Name
    // Direction list: ### ðŸ“š University Name yo'nalishlari
    // Region overview: ### ðŸ› Region Name â€” "Toshkent shahri" ni topic sifatida
    // MUHIM: faqat yangi topic topilganda metadata ni yangilaymiz, aks holda
    // eski topic nomi o'chib ketadi!
    const content = sanitizedContent || '';
    const singleUniMatch = content.match(/## ðŸ› ([^\n]+)/);
    const dirMatch = content.match(/### ðŸ“š ([^\n]+) yo'nalishlari/i);
    const regionMatch = content.match(/### ðŸ› ([^\n]+) universitetlari/i);
    const newTopicName = 
      singleUniMatch?.[1]?.trim() || 
      dirMatch?.[1]?.trim() || 
      regionMatch?.[1]?.trim();

    const messageIntent = intentClassifier.classify(message);
    const entities = messageIntent.entities || {};
    const metadataUpdate: Record<string, any> = { ...metadata };

    if (entities.region) metadataUpdate.currentRegion = entities.region;
    if (entities.institutionCategory) metadataUpdate.currentInstitutionCategory = entities.institutionCategory;
    if (entities.direction) metadataUpdate.currentDirectionCategory = entities.direction;
    if (entities.degree) metadataUpdate.currentDegree = entities.degree;
    if (entities.language) metadataUpdate.currentLanguage = entities.language;
    if (messageIntent.intent === "grant_search" || /\b(grant|stipendiya|scholarship|bepul|tekin)\b/i.test(message)) {
      metadataUpdate.interestGrant = true;
    }

    if (newTopicName && newTopicName.length > 3) {
      metadataUpdate.currentTopicName = newTopicName;
    } else if (!metadataUpdate.currentTopicName) {
      // Agar eski topic nomi bo'lmasa, uni o'rnatmaymiz
    }
    // currentTopicName ni saqlash
    // Agar oldingi topic nomi bor bo'lsa va yangisi topilmasa â†’ eskisini saqlaymiz
    // Agar yangisi topilsa â†’ yangisini ishlatamiz

    // Update session with topic name in metadata
    await prisma.chatSession.update({
      where: { id: session.id },
      data: {
        updatedAt: new Date(),
        language,
        metadata: metadataUpdate,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: sanitizedContent,
        sessionId: session.id,
        intent: response.intent,
        toolUsed: response.toolUsed,
        suggestions: getSuggestions(response.intent || ""),
      },
    });
  } catch (error) {
    console.error("[Chat Error]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (sessionId) {
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 50,
          },
        },
      });

      if (!session) {
        return NextResponse.json(
          { success: false, error: "Session not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          session,
          messages: session.messages,
        },
      });
    }

    // Return all sessions
    const sessions = await prisma.chatSession.findMany({
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        language: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: sessions });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

function getSuggestions(intent: string): string[] {
  switch (intent) {
    case "university_search":
      return [
        "Toshkentdagi xususiy universitetlar",
        "Grantli universitetlar",
        "PDP University haqida ma'lumot",
        "Yotoqxonali universitetlar",
      ];
    case "direction_search":
      return [
        "IT yo'nalishlari",
        "Ingliz tilidagi magistratura",
        "Kunduzgi bakalavr dasturlari",
        "Sirtqi ta'lim yo'nalishlari",
      ];
    case "grant_search":
      return [
        "100% grantlar",
        "IELTS grantlari",
        "Toshkentdagi grantlar",
        "PDP grantlari",
      ];
    case "news_search":
      return [
        "So'nggi yangiliklar",
        "Grant yangiliklari",
        "Universitet yangiliklari",
      ];
    default:
      return [
        "Universitetlar haqida ma'lumot",
        "Grantlar haqida ma'lumot",
        "Yo'nalishlarni ko'rish",
        "Ta'lim yangiliklari",
      ];
  }
}

