import { NextRequest, NextResponse } from "next/server";
import { llmService } from "@/ai-agent/llm-service";
import { intentClassifier } from "@/ai-agent/intent-classifier";
import { GENERIC_TOPIC_HEADING } from "@/ai-agent/direction-synonyms";
import { getSelfCompleteIntents } from "@/ai-agent/intent-config";
import prisma from "@/lib/prisma";
import { sanitizeText } from "@/lib/sanitize-text";
import { apiAuthContext } from "@/lib/api-auth-context";
import { getAuthUser, extractGuestId, persistRefreshedUserTokens } from "@/lib/auth";
import type { ChatMessage, SessionContext } from "@/types";

// request.url ishlatilgani uchun statik render qilinmaydi (DYNAMIC_SERVER_USAGE xatosini oldini oladi)
export const dynamic = "force-dynamic";
// Vercel serverless funksiya limiti: standart 10s — AI + API chaqiruvlari uzoqroq davom etishi mumkin
export const maxDuration = 60;

/**
 * Session egasini aniqlaydi: login qilgan user → userId (JWT'dan),
 * login qilmagan (guest) → guestId (X-Guest-Id header). Ikkalasi ham
 * yo'q bo'lsa — undefined (session faqat yangi ochiladi, izolyatsiyasiz).
 */
function ownerFilter(userId: number | null, guestId: string | null): Record<string, any> | undefined {
  if (userId) return { userId };
  if (guestId) return { guestId };
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    // ===== AUTH (BOSQICH 1 + GUEST REJIM) =====
    // Login qilgan user → userId (token'dan, frontendga ishonilmaydi).
    // Login qilmagan (guest) → X-Guest-Id header orqali kelgan guestId bilan
    // izolyatsiya qilinadi. GUEST REJIM: guest'lar ham AI ishlatadi — 401
    // qo'yilmaydi, lekin ularning tarixi saqlanmaydi.
    const authUser = await getAuthUser(request);
    const guestId = extractGuestId(request);
    const userId = authUser?.userId ?? null;

    const body = await request.json();
    const { message, sessionId, language = "uz" } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    // Get or create session (faqat shu user/guest'ning session'lariga kirish mumkin!)
    // MUHIM (claim uchun): user ham, guestId ham kelganda avval user'ning o'z
    // session'i, topilmasa — guest session qidiriladi (login'da claim qilinadi).
    let session;
    if (sessionId) {
      const withMessages = { messages: { orderBy: { createdAt: "asc" } } } as const;
      if (userId) {
        session = await prisma.chatSession.findFirst({
          where: { id: sessionId, userId },
          include: withMessages,
        });
        // GUEST → USER claim: user session'iga tegishli emas, lekin shu
        // brauzerning guest session'i bo'lsa — claim uchun uni olamiz.
        if (!session && guestId) {
          session = await prisma.chatSession.findFirst({
            where: { id: sessionId, guestId },
            include: withMessages,
          });
        }
      } else if (guestId) {
        session = await prisma.chatSession.findFirst({
          where: { id: sessionId, guestId },
          include: withMessages,
        });
      }
    }

    if (!session) {
      // Detect intent for session title
      const intent = intentClassifier.classify(message);
      session = await prisma.chatSession.create({
        data: {
          title: message.substring(0, 100),
          language,
          ...(userId ? { userId } : guestId ? { guestId } : {}),
        },
        include: { messages: true },
      });
    }

    // GUEST → USER (BOSQICH 1 + GUEST REJIM): login qilgan foydalanuvchi o'z
    // guest session'ini davom ettirsa, session'ni accountinga biriktiramiz —
    // shu paytdan boshlab tarix saqlanadi ("ularni datasi login qilmaguncha
    // saqlanmaydi" qoidasi: login qilganda saqlana boshlaydi).
    if (userId && guestId && session && !session.userId && session.guestId === guestId) {
      session = await prisma.chatSession.update({
        where: { id: session.id },
        data: { userId, guestId: null },
        include: { messages: { orderBy: { createdAt: "asc" } } },
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
      // GUEST REJIM: login qilmagan → isGuest=true → ToolAccessPolicy data
      // tool'larini bloklaydi (Mentalaba API'ga chiqilmaydi, login so'raladi).
      isGuest: !authUser,
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
      currentTuitionMax: metadata.currentTuitionMax as number | undefined,
      currentTuitionMin: metadata.currentTuitionMin as number | undefined,
      recommendationProfile: metadata.recommendationProfile as SessionContext["recommendationProfile"] | undefined,
      lastRecommendations: metadata.lastRecommendations as SessionContext["lastRecommendations"] | undefined,
      lastUniversity: metadata.lastUniversity as SessionContext["lastUniversity"] | undefined,
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

    // Generate AI response (user tokeni kontekstida — Mentalaba API'ga user tokeni bilan murojaat qilinadi)
    // PER-USER TOKEN (BOSQICH 1): apiAuthContext ichida ishlaydi. API 401 qaytarsa,
    // user refresh tokeni bilan yangilanib, onTokenRefreshed orqali DB'ga yoziladi.
    // GUEST REJIM: login qilmaganlar uchun kontekst bo'sh bo'ladi — external-api
    // shunda o'z default (global) tokenidan foydalanadi.
    const response = await apiAuthContext.run(
      {
        accessToken: authUser?.accessToken || "",
        refreshToken: authUser?.refreshToken || undefined,
        onTokenRefreshed: (access, refresh) => {
          if (authUser) void persistRefreshedUserTokens(authUser.userId, access, refresh);
        },
      },
      () =>
        llmService.generateResponse(
          message,
          sessionContext,
          conversationHistory,
          language
        )
    );

    // Save and sanitize AI response
    const sanitizedContent = sanitizeText(response.content || '');
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: sanitizedContent,
        intent: response.intent,
        selectedTool: response.toolUsed,
      },
    });

    // Extract topic name from response for follow-up detection.
    // Do not depend on emoji bytes here: older files had mojibake like "ðŸ...",
    // while current responses use clean emoji or sometimes no emoji at all.
    const content = sanitizedContent || '';
    const cleanHeading = (value?: string) =>
      value
        ?.replace(/^[^\p{L}\p{N}'"`]+/u, '')
        .replace(/\s+(haqida|yo'nalishlari|universitetlari|ro'yxati|kontrakt narxi|kontrakti|narxi)\s*$/i, '')
        .trim();

    const singleUniMatch = content.match(/^#{1,3}\s*(?:🏛\s*)?(.+?)(?:\n|$)/m);
    const dirMatch = content.match(/^#{1,3}\s*(?:📚\s*)?(.+?)\s+yo'nalishlari(?:\n|$)/im);
    const regionMatch = content.match(/^#{1,3}\s*(?:🏛\s*)?(.+?)\s+universitetlari(?:\n|$)/im);
    let extractedTopicName =
      cleanHeading(dirMatch?.[1]) ||
      cleanHeading(regionMatch?.[1]) ||
      cleanHeading(singleUniMatch?.[1]);

    // MUHIM: shablon sarlavhalari mavzu bo'lib qolmasin!
    // "Sizga eng yaxshi variantni topaman!" kabi generic sarlavhalar
    // currentTopicName ga yozilib qolsa, keyingi follow-up so'rovlar buziladi.
    if (extractedTopicName && GENERIC_TOPIC_HEADING.test(extractedTopicName)) {
      extractedTopicName = undefined;
    }

    const messageIntent = intentClassifier.classify(message);
    const entities = messageIntent.entities || {};
    const metadataUpdate: Record<string, any> = { ...metadata };

    if (entities.region) metadataUpdate.currentRegion = entities.region;
    if (entities.institutionCategory) metadataUpdate.currentInstitutionCategory = entities.institutionCategory;
    if (entities.direction) metadataUpdate.currentDirectionCategory = entities.direction;
    if (entities.degree) metadataUpdate.currentDegree = entities.degree;
    if (entities.language) metadataUpdate.currentLanguage = entities.language;
    // BOSQICH 3: byudjet entity'larini ham session kontekstida saqlaymiz
    // ("Toshkentdagi universitetlar → 20 mln gachasi" zanjiri uchun)
    if (entities.tuitionMax !== undefined) metadataUpdate.currentTuitionMax = entities.tuitionMax;
    if (entities.tuitionMin !== undefined) metadataUpdate.currentTuitionMin = entities.tuitionMin;
    if (messageIntent.intent === "grant_search" || /\b(grant|stipendiya|scholarship|bepul|tekin)\b/i.test(message)) {
      metadataUpdate.interestGrant = true;
    }

    // ===== RECOMMENDATION PROFILE (BOSQICH 9) =====
    // Session bo'ylab foydalanuvchi profili to'planadi (JARVIS usuli):
    //   "Matematikam yaxshi" → strengths:["matematika"]
    //   "Pulim kam"         → budgetLevel:"low"
    //   "Toshkentda o'qimoqchiman" → city:"Toshkent"
    //   "Ingliz tilim C1"   → language:"english"
    //   "Magistratura"      → degree:"master"
    // Har bir yangi so'rovda yangi ma'lumotlar qo'shilib boradi.
    const profile: NonNullable<SessionContext["recommendationProfile"]> =
      metadataUpdate.recommendationProfile ?? {};
    const addToArray = (key: "interests" | "strengths" | "weaknesses", value?: string) => {
      if (!value) return;
      const arr = (profile[key] = profile[key] || []);
      const lowerVal = value.toLowerCase();
      if (!arr.some((v) => v.toLowerCase() === lowerVal)) arr.push(value);
    };

    // Kuchli tomonlar: "matematikam yaxshi", "biologiyam kuchli", "inglizim C1"
    // MUHIM (reviewer fix): "matematikam yaxshi emas" strength EMAS — negative
    // lookahead "emas/yo'q" kelsa strength hisoblanmaydi (ziddiyatli profil).
    const strengthMatch =
      message.toLowerCase().match(/([a-zāōūģķļņŗşž'’\-]+)(?:m|im)?\s+(yaxshi|kuchli|zo'r|a'lo|yaxshi darajada|yaxshiroq)(?!\s+(emas|yo'q|kuchli emas|zo'r emas)\b)/i) ||
      message.toLowerCase().match(/([a-zāōūģķļņŗşž'’\-]+)\s+(C1|C2|B2|B1)\b/i);
    if (strengthMatch && strengthMatch[1] && !/\b(men|biz|bu|shu)\b/i.test(strengthMatch[1])) {
      // "tilim C1" emas — "inglizim C1" to'liq olinadi
      const cleanStrength = strengthMatch[1].replace(/\b(tilim|tili|til)\b/i, "").trim();
      if (cleanStrength.length >= 3) addToArray("strengths", cleanStrength);
    }
    // Zaif tomonlar: "matematikam past", "fizikam unchalik emas"
    // MUHIM (reviewer fix): weakness strength'da qo'shilgan bo'lsa uni
    // strengths'dan olib tashlaymiz ("matematikam yaxshi emas" holati).
    const weaknessMatch = message.toLowerCase().match(/([a-zāōūģķļņŗşž'’\-]+)(?:m|im)?\s+(past|zaif|unchalik emas|yaxshi emas|kuchsiz|zo'r emas)(?<!\b(zo'r|kuchli|yaxshi)\s+)/i);
    if (weaknessMatch && weaknessMatch[1] && !/\b(men|biz|bu|shu)\b/i.test(weaknessMatch[1])) {
      const weak = weaknessMatch[1].trim();
      // Agar shu so'z strength'ga qo'shilgan bo'lsa ("matematikam yaxshi emas"
      // noto'g'ri strength bo'lib qolgan) — olib tashlaymiz, ziddiyat yo'qoladi.
      const strengthIdx = (profile.strengths || []).findIndex(
        (s) => s.toLowerCase() === weak.toLowerCase()
      );
      if (strengthIdx >= 0) profile.strengths!.splice(strengthIdx, 1);
      addToArray("weaknesses", weak);
    }
    // Qiziqishlar: "AI ga qiziqaman", "tibbiyotga qiziqaman", "IT yoqadi"
    if (entities.direction && /\b(qiziq|yoqadi|yaxshi ko'raman|ishlamoqchiman|bo'lmoqchiman)\b/i.test(message)) {
      addToArray("interests", entities.direction);
    }
    // Budjet: "pulim kam", "budjetim cheklangan"
    if (/\b(pulim|mablag'im|mablagim|byudjetim|budjetim)\s+(kam|oz|cheklangan|yetarli emas|yetmaydi)\b/i.test(message)) {
      profile.budgetLevel = "low";
    }
    if (/\b(pulim|mablag'im|mablagim)\s+(yetarli|ko'p|yaxshi)\b/i.test(message)) {
      profile.budgetLevel = "high";
    }
    // Shahar: region entity'dan profil city
    if (entities.region && metadataUpdate.currentRegion) {
      // Region ID'ni nomga aylantirish chat route'da lookup yo'q — city o'rniga
      // metadataUpdate.currentRegion (ID) saqlanadi; profil city ko'rsatish uchun
      // entity extractor'dagi region nomini saqlash qiyin — shuning uchun
      // region ID profilga ham yoziladi (tool-router uni o'qiydi).
      profile.city = entities.region;
    }
    // Til: "ingliz tilim yaxshi"
    if (entities.language) profile.language = entities.language;
    // Daraja: "magistratura"
    if (entities.degree) profile.degree = entities.degree;
    // Grant qiziqishi
    if (metadataUpdate.interestGrant) profile.interestGrant = true;
    // Xorij: "xorijga ketmoqchiman", "chet elda o'qimoqchiman"
    if (/\b(xorij|chet el|abroad|dunyo)\w*\s+(ketmoqchiman|o'qimoqchiman|bormoqchiman|chiqmoqchiman)\b/i.test(message)) {
      profile.wantsForeign = true;
    }

    if (Object.keys(profile).length > 0) {
      metadataUpdate.recommendationProfile = profile;
    }
    // ===== RECOMMENDATION PROFILE (yakun) =====

    // ===== RECOMMENDATION MEMORY (BOSQICH 9) =====
    // provider-manager sessionContext.lastRecommendations ni yangilagan bo'lsa
    // (recommend tool ishlaganda), uni metadata'ga yozamiz — keyingi
    // so'rovlarda eslab qolinadi ("Yotoqxonasi bormi?" kabi follow-up).
    // MUHIM (reviewer fix): bo'sh bo'lsa eski (stale) ro'yxat saqlanmasin.
    if (sessionContext.lastRecommendations && sessionContext.lastRecommendations.length > 0) {
      metadataUpdate.lastRecommendations = sessionContext.lastRecommendations;
    } else {
      delete metadataUpdate.lastRecommendations;
    }
    // ===== RECOMMENDATION MEMORY (yakun) =====

    // ===== LAST UNIVERSITY MEMORY (BOSQICH 11) =====
    // provider-manager/tool-router sessionContext.lastUniversity ni yangilagan
    // bo'lsa (search_university / search_direction / recommend / get_university
    // ishlaganda), uni metadata'ga yozamiz — keyingi so'rovlarda eslab qolinadi
    // ("uning narxlari qancha?" kabi follow-up). Bo'sh bo'lsa eski (stale)
    // ro'yxat saqlanmasin.
    if (sessionContext.lastUniversity) {
      metadataUpdate.lastUniversity = sessionContext.lastUniversity;
    } else {
      delete metadataUpdate.lastUniversity;
    }
    // ===== LAST UNIVERSITY MEMORY (yakun) =====

    const isExplicitUniversitySwitch = messageIntent.intent === "university_search" && !!entities.university;

    // MUHIM: selfComplete intent'lar (greeting, thanks, direction_list, etc.)
    // o'z-o'zidan to'liq — keyingi follow-up'lar buzilmasligi uchun
    // eski kontekstni tozalaymiz. "Rahmat" dan keyin "Telefon raqamini bering"
    // eski mavzu bilan buzilib qolmasligi kerak.
    const selfCompleteIntents = getSelfCompleteIntents();
    // MUHIM (Fix 19): currentTopicName ni HAMMA selfComplete intent uchun
    // o'chirib bo'lmaydi! "faq" (Rektori kim?), "tuition_search" (Kontrakti
    // qancha?), "admission" (Qabul ochilganmi?) — bularning barchasi
    // follow-up savollar bo'lib, KEYINGI xabarga mavzu sifatida kerak.
    // Faqat YANGI MAVZU ochuvchi intent'larda (greeting, thanks, *_list)
    // topic tozalanadi. Aks holda "TATU → Kontrakti qancha? → Telefon
    // raqami?" zanjiri uzilib qolardi.
    const topicClearingIntents = ["greeting", "thanks", "university_list", "direction_list", "grant_list", "news_list", "news_search"];
    if (selfCompleteIntents.includes(messageIntent.intent)) {
      delete metadataUpdate.currentDirectionCategory;
      delete metadataUpdate.currentRegion;
      delete metadataUpdate.currentInstitutionCategory;
      delete metadataUpdate.currentDegree;
      delete metadataUpdate.currentLanguage;
      delete metadataUpdate.currentTuitionMax;
      delete metadataUpdate.currentTuitionMin;
      delete metadataUpdate.interestGrant;
      if (topicClearingIntents.includes(messageIntent.intent)) {
        delete metadataUpdate.currentTopicName;
      }
    }

    const newTopicName = extractedTopicName || (isExplicitUniversitySwitch ? entities.university : undefined);

    if (isExplicitUniversitySwitch) {
      delete metadataUpdate.currentDirectionCategory;
      delete metadataUpdate.currentRegion;
      delete metadataUpdate.currentInstitutionCategory;
      delete metadataUpdate.currentDegree;
      delete metadataUpdate.currentLanguage;
      delete metadataUpdate.currentTuitionMax;
      delete metadataUpdate.currentTuitionMin;
    }

    if (newTopicName && newTopicName.length > 3) {
      metadataUpdate.currentTopicName = newTopicName;
    } else if (!metadataUpdate.currentTopicName) {
      // Agar eski topic nomi bo'lmasa, uni o'rnatmaymiz
    }
    // currentTopicName ni saqlash
    // Agar oldingi topic nomi bor bo'lsa va yangisi topilmasa → eskisini saqlaymiz
    // Agar yangisi topilsa → yangisini ishlatamiz

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
        messageId: assistantMessage.id,
        sessionId: session.id,
        intent: response.intent,
        toolUsed: response.toolUsed,
        auth_required: (response as any).auth_required === true,
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
    // ===== AUTH (BOSQICH 1 + GUEST REJIM) =====
    const authUser = await getAuthUser(request);
    const guestId = extractGuestId(request);
    const userId = authUser?.userId ?? null;

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (sessionId) {
      const owner = ownerFilter(userId, guestId);
      const session = owner
        ? await prisma.chatSession.findFirst({
            where: { id: sessionId, ...owner },
            include: {
              messages: {
                orderBy: { createdAt: "asc" },
                take: 50,
              },
            },
          })
        : null;

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

    // Sessionlar ro'yxati: FAQAT login qilgan userlar uchun!
    // GUEST REJIM: guest'lar tarixi saqlanmaydi — ularga bo'sh ro'yxat qaytadi
    // (joriy suhbat brauzerda guestId orqali davom etadi).
    if (!userId) {
      return NextResponse.json({ success: true, data: [] });
    }

    const sessions = await prisma.chatSession.findMany({
      where: { userId },
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

export async function DELETE(request: NextRequest) {
  try {
    // ===== AUTH (BOSQICH 1 + GUEST REJIM) =====
    const authUser = await getAuthUser(request);
    const guestId = extractGuestId(request);
    const userId = authUser?.userId ?? null;

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "sessionId is required" },
        { status: 400 }
      );
    }

    const owner = ownerFilter(userId, guestId);
    const session = owner
      ? await prisma.chatSession.findFirst({ where: { id: sessionId, ...owner } })
      : null;
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    // Tartib muhim: avval feedback, keyin messages, keyin session
    // (FK cheklovlari tufayli — chat_feedback va chat_messages session'ga bog'langan)
    await prisma.$transaction([
      prisma.chatFeedback.deleteMany({ where: { sessionId } }),
      prisma.chatMessage.deleteMany({ where: { sessionId } }),
      prisma.chatSession.delete({ where: { id: sessionId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Delete Session Error]", error);
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
    case "direction_list":
      return [
        "IT yo'nalishlari",
        "Tibbiyot yo'nalishlari",
        "Iqtisod yo'nalishlari",
        "Pedagogika yo'nalishlari",
      ];
    case "direction_search":
      return [
        "IT yo'nalishlari",
        "Ingliz tilidagi magistratura",
        "Kunduzgi bakalavr dasturlari",
        "Sirtqi ta'lim yo'nalishlari",
      ];
    case "grant_list":
      return [
        "Qanday grantlar bor",
        "100% grantlar",
        "Toshkentdagi grantlar",
      ];
    case "grant_search":
      return [
        "100% grantlar",
        "IELTS grantlari",
        "Toshkentdagi grantlar",
        "PDP grantlari",
      ];
    case "tuition_search":
      return [
        "Eng arzon universitetlar",
        "Toshkentdagi eng arzon universitet",
        "Kontrakt narxlari qancha",
      ];
    case "news_list":
    case "news_search":
      return [
        "So'nggi yangiliklar",
        "Grant yangiliklari",
        "Universitet yangiliklari",
      ];
    case "university_list":
      return [
        "Qanday universitetlar bor",
        "Toshkentdagi universitetlar",
        "Davlat universitetlari",
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
