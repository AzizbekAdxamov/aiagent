import OpenAI from "openai";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import type { ChatMessage } from "@/types";
import { contextBuilder } from "./context-builder";
import { intentClassifier } from "./intent-classifier";
import { toolRouter } from "./tool-router";
import { lookupManager } from "@/data/lookups";
import { embeddingService } from "./embedding-service";

export type AIProvider = "groq" | "gemini" | "openai";

class ProviderManager {
  private groqClient: OpenAI | null = null;
  private geminiModel: GenerativeModel | null = null;
  private openaiClient: OpenAI | null = null;
  private activeProvider: AIProvider = "groq";
  private initialized = false;

  getActiveProvider(): AIProvider {
    return this.activeProvider;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getProvidersStatus(): Array<{ name: AIProvider; displayName: string; configured: boolean; freeTier: boolean }> {
    return [
      {
        name: "groq",
        displayName: "Groq (Llama)",
        configured: !!process.env.GROQ_API_KEY,
        freeTier: true,
      },
      {
        name: "gemini",
        displayName: "Google Gemini",
        configured: !!process.env.GEMINI_API_KEY,
        freeTier: true,
      },
      {
        name: "openai",
        displayName: "OpenAI GPT",
        configured: !!process.env.OPENAI_API_KEY,
        freeTier: false,
      },
    ];
  }

  private hasRegionMention(message: string): boolean {
    return /\b(?:toshkent(?:da|dagi|ga|dan|ning|ni)?|samarqand(?:da|dagi|ga|dan|ning|ni)?|buxoro(?:da|dagi|ga|dan|ning|ni)?|andijon(?:da|dagi|ga|dan|ning|ni)?|farg(?:'ona|ona)(?:da|dagi|ga|dan|ning|ni)?|namangan(?:da|dagi|ga|dan|ning|ni)?|qarshi(?:da|dagi|ga|dan|ning|ni)?|urganch(?:da|dagi|ga|dan|ning|ni)?|nukus(?:da|dagi|ga|dan|ning|ni)?|jizzax(?:da|dagi|ga|dan|ning|ni)?|navoiy(?:da|dagi|ga|dan|ning|ni)?|xorazm(?:da|dagi|ga|dan|ning|ni)?|sirdaryo(?:da|dagi|ga|dan|ning|ni)?|surxondaryo(?:da|dagi|ga|dan|ning|ni)?)\b/i.test(message);
  }

  private hasCategoryMention(message: string): boolean {
    return /\b(?:davlat(?:da|dagi|ga|dan|ning|ni)?|xususiy(?:da|dagi|ga|dan|ning|ni)?|xalqaro(?:da|dagi|ga|dan|ning|ni)?|public|private|state|international|nodavlat(?:da|dagi|ga|dan|ning|ni)?)\b/i.test(message);
  }

  private hasDirectionMention(message: string): boolean {
    return /\b(?:it|tibbiyot(?:da|dagi|ga|dan|ning|ni)?|iqtisod(?:da|dagi|ga|dan|ning|ni)?|huquq(?:da|dagi|ga|dan|ning|ni)?|pedagogika(?:da|dagi|ga|dan|ning|ni)?|muhandislik(?:da|dagi|ga|dan|ning|ni)?|filologiya(?:da|dagi|ga|dan|ning|ni)?|sanat(?:da|dagi|ga|dan|ning|ni)?|sport(?:da|dagi|ga|dan|ning|ni)?|turizm(?:da|dagi|ga|dan|ning|ni)?|qishloq(?:da|dagi|ga|dan|ning|ni)?)\b/i.test(message);
  }

  private getInstitutionCategoryLabel(categoryId: string): string | null {
    if (categoryId === "3") return "davlat";
    if (categoryId === "4") return "xususiy";
    if (categoryId === "5") return "xalqaro";
    return null;
  }

  init() {
    // Initialize Groq (OpenAI-compatible)
    if (process.env.GROQ_API_KEY) {
      this.groqClient = new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1",
      });
      this.activeProvider = "groq";
      this.initialized = true;
      console.log("[Provider] Groq initialized");
    }

    // Initialize Gemini
    if (process.env.GEMINI_API_KEY) {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.geminiModel = genAI.getGenerativeModel({
        model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      });
      if (!this.initialized) {
        this.activeProvider = "gemini";
        this.initialized = true;
      }
      console.log("[Provider] Gemini initialized");
    }

    // Initialize OpenAI (fallback)
    if (process.env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      if (!this.initialized) {
        this.activeProvider = "openai";
        this.initialized = true;
      }
      console.log("[Provider] OpenAI initialized");
    }

    if (!this.initialized) {
      console.log("[Provider] No AI provider configured, using template fallback");
    }
  }

  async generateResponse(
    userMessage: string,
    sessionContext: any,
    conversationHistory: ChatMessage[],
    language: "uz" | "ru" | "en" = "uz"
  ): Promise<{ content: string; intent?: string; toolUsed?: string; provider?: string }> {
    try {
      // Auto-initialize if not yet initialized
      if (!this.initialized) {
        this.init();
        embeddingService.init();
        console.log("[Provider] Auto-initialized on first request");
      }

      // Step 1: Classify intent
      let intent = intentClassifier.classify(userMessage);
      let effectiveMessage = userMessage;

      // Step 1.5: Follow-up detection
      // MUHIM: faqat DATA intents (university_search, direction_search) uchun enhancement qilamiz.
      // "so'nggi yangiliklar" -> news_search, "salom" -> greeting, "rahmat" -> faq kabi
      // conversational intents da topicName ni qo'shish NOTO'G'RI natijaga olib keladi!
      // Sababi: "Amity Universiteti so'nggi yangiliklar" -> university_search patterniga tushadi!
      const nonEnhanceIntents = ["news_search", "greeting", "faq", "admission", "transfer"];

      const wordCount = userMessage.trim().split(/\s+/).length;
      // MUHIM TUZATISH: agar joriy xabarning o'zida ANIQ universitet nomi bo'lsa
      // (masalan foydalanuvchi yo'nalish haqida so'rab turib, to'satdan "Amity
      // universiteti haqida ayt" desa), bu — MAVZU ALMASHISHI. Bunday holda eski
      // sessionContext.currentTopicName ni yangi xabarga QO'SHMASLIK kerak, aks
      // holda "Amity universiteti haqida ayt" xabari eski mavzu nomi bilan
      // "EskiUniversitet Amity universiteti haqida ayt" bo'lib, ikkala universitet
      // aralashib ketadi va noto'g'ri natija chiqadi.
      const isTopicSwitch = !!intent.entities?.university;
      if (wordCount < 8 && !nonEnhanceIntents.includes(intent.intent) && !isTopicSwitch) {
        // Topic nomini aniqlash (sessionContext -> conversation history)
        let topicName = sessionContext?.currentTopicName as string | undefined;
        if ((!topicName || topicName.length <= 3) && conversationHistory?.length > 0) {
          const lastAsst = [...conversationHistory].reverse().find(m => m.role === "assistant");
          if (lastAsst?.content) {
            topicName = lastAsst.content.match(/## 🏛 ([^\n]+)/)?.[1]?.trim()
              || lastAsst.content.match(/### 📚 ([^\n]+) yo'nalishlari/i)?.[1]?.trim();
          }
        }

        // Agar topic nomi topilgan bo'lsa va message da o'sha nom YO'Q bo'lsa
        if (topicName && topicName.length > 3) {
          const msgLower = userMessage.toLowerCase();
          const topicLower = topicName.toLowerCase();
          // University name hali message da yo'qmi? (agar bo'lsa, takrorlash kerak emas)
          const hasUniName = msgLower.includes(topicLower) ||
            topicLower.split(' ').some((part: string) => part.length > 4 && msgLower.includes(part));

          if (!hasUniName) {
            const enhanced = `${topicName} ${userMessage}`;
            effectiveMessage = enhanced;
            intent = intentClassifier.classify(enhanced);
            console.log(`[FollowUp] Enhanced "${userMessage}" -> "${effectiveMessage}" -> ${intent.intent}`);
          }
        }

        if (sessionContext?.currentRegion || sessionContext?.currentInstitutionCategory || sessionContext?.currentDirectionCategory) {
          const additions: string[] = [];
          if (sessionContext.currentRegion && !this.hasRegionMention(effectiveMessage)) {
            const regionName = lookupManager.getRegionName(parseInt(sessionContext.currentRegion), language);
            if (regionName) additions.push(regionName);
          }
          if (sessionContext.currentInstitutionCategory && !this.hasCategoryMention(effectiveMessage)) {
            const categoryLabel = this.getInstitutionCategoryLabel(sessionContext.currentInstitutionCategory);
            if (categoryLabel) additions.push(categoryLabel);
          }
          if (sessionContext.currentDirectionCategory && !this.hasDirectionMention(effectiveMessage)) {
            additions.push(sessionContext.currentDirectionCategory);
          }
          if (additions.length > 0) {
            const enhanced = `${additions.join(' ')} ${effectiveMessage}`;
            effectiveMessage = enhanced;
            intent = intentClassifier.classify(enhanced);
            console.log(`[FollowUp] Session context augmented "${userMessage}" -> "${effectiveMessage}" -> ${intent.intent}`);
          }
        }
      }

      // Step 2: Execute tools
      let toolResults: any[] = [];
      try {
        toolResults = await toolRouter.execute(intent, sessionContext, effectiveMessage);
      } catch (error) {
        console.error("[Tool Error]", error);
      }

      // Step 3: DATA intents
      // MUHIM: agar tool HAQIQIY ma'lumot topgan bo'lsa (bo'sh emas), endi qattiq
      // shablon o'rniga AI'ning o'ziga beramiz — u context'dagi HAQIQIY ma'lumotni
      // (universitet tavsifi, narxi, kontakti va h.k.) tabiiy, savolga moslashtirilgan
      // tilda taqdim etadi. Hallucination xavfi yo'q, chunki system prompt AI'ga
      // faqat context'dagi ma'lumotdan foydalanishni qattiq talab qiladi.
      // Faqat ma'lumot UMUMAN topilmagan hollarda (bo'sh natija, xato) shablonga
      // tushamiz — bu holatda AI o'ylab topib qo'yishi mumkin, shablon esa xavfsiz
      // "topilmadi" javobini beradi.
      const dataIntents = ["university_search", "direction_search", "grant_search", "comparison", "recommendation"];
      const isDataIntent = dataIntents.includes(intent.intent);
      const hasRealData = toolResults.some((r: any) => {
        if (!r.success || !r.data) return false;
        if (Array.isArray(r.data)) return r.data.length > 0;
        if (typeof r.data === "object") {
          const arrays = Object.values(r.data).filter((v: any) => Array.isArray(v));
          if (arrays.some((a: any) => a.length > 0)) return true;
          if ((r.data as any).needsClarification) return true;
          if ((r.data as any).id) return true;
          if ((r.data as any).universityOverview || (r.data as any).regionOverview) return true;
          return false;
        }
        return false;
      });

      if (isDataIntent && !hasRealData) {
        // Ma'lumot topilmadi — xavfsiz shablon javobi (AI o'ylab topmasin)
        const content = this.getTemplateResponse(intent.intent, toolResults, userMessage, language);
        return {
          content,
          intent: intent.intent,
          toolUsed: toolResults.length > 0 ? toolResults.map((r: any) => r.tool).filter(Boolean).join(", ") : "none",
          provider: "template",
        };
      }

      // Step 3.5: GREETING -> TEMPLATE
      // AI provider "salom" desa universitet haqida gapirib yuboradi, template to'g'ri salomlashadi
      if (intent.intent === "greeting") {
        const content = this.getTemplateResponse(intent.intent, toolResults, userMessage, language);
        return {
          content,
          intent: intent.intent,
          toolUsed: "none",
          provider: "template",
        };
      }

      // No provider configured -> use template (even for conversational)
      if (!this.initialized) {
        const content = this.getTemplateResponse(intent.intent, toolResults, userMessage, language);
        return {
          content,
          intent: intent.intent,
          toolUsed: toolResults.length > 0 ? toolResults.map((r: any) => r.tool).filter(Boolean).join(", ") : "none",
          provider: "template",
        };
      }

      // CONVERSATIONAL INTENT or NO DATA -> use AI model
      // Build context for AI
      const systemPrompt = contextBuilder.buildSystemPrompt(language);
      const context = contextBuilder.buildContext(toolResults, sessionContext, language);

      // Try providers in order
      const errors: string[] = [];

      // Try Groq first (fastest, free)
      if (this.groqClient) {
        try {
          const result = await this.callGroq(systemPrompt, context, conversationHistory, userMessage);
          return {
            ...result,
            intent: intent.intent,
            toolUsed: toolResults.length > 0 ? toolResults.map((r: any) => r.tool).filter(Boolean).join(", ") : "none",
            provider: "groq",
          };
        } catch (error: any) {
          errors.push(`Groq: ${error.message}`);
          console.error("[Groq Error]", error);
        }
      }

      // Try Gemini next (free, backup)
      if (this.geminiModel) {
        try {
          const result = await this.callGemini(systemPrompt, context, conversationHistory, userMessage);
          return {
            ...result,
            intent: intent.intent,
            toolUsed: toolResults.length > 0 ? toolResults.map((r: any) => r.tool).filter(Boolean).join(", ") : "none",
            provider: "gemini",
          };
        } catch (error: any) {
          errors.push(`Gemini: ${error.message}`);
          console.error("[Gemini Error]", error);
        }
      }

      // Try OpenAI last
      if (this.openaiClient) {
        try {
          const result = await this.callOpenAI(systemPrompt, context, conversationHistory, userMessage);
          return {
            ...result,
            intent: intent.intent,
            toolUsed: toolResults.length > 0 ? toolResults.map((r: any) => r.tool).filter(Boolean).join(", ") : "none",
            provider: "openai",
          };
        } catch (error: any) {
          errors.push(`OpenAI: ${error.message}`);
          console.error("[OpenAI Error]", error);
        }
      }

      // All providers failed, use template fallback
      console.error("[Provider] All providers failed:", errors.join("; "));
      const content = this.getTemplateResponse(intent.intent, toolResults, userMessage, language);
      return {
        content,
        intent: intent.intent,
        toolUsed: toolResults.length > 0 ? toolResults.map((r: any) => r.tool).filter(Boolean).join(", ") : "none",
        provider: "template",
      };
    } catch (error: any) {
      console.error("[Provider Manager Error]", error);
      return {
        content: "Kechirasiz, hozircha javob yaratishda xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko'ring.",
        intent: "unknown",
        toolUsed: "none",
        provider: "none",
      };
    }
  }

  private async callGroq(
    systemPrompt: string,
    context: string,
    conversationHistory: ChatMessage[],
    userMessage: string
  ): Promise<{ content: string }> {
    if (!this.groqClient) throw new Error("Groq not initialized");

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (context) {
      messages.push({ role: "system", content: `Context:\n${context}` });
    }

    for (const msg of conversationHistory.slice(-8)) {
      if (msg.role !== "system") {
        messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
      }
    }

    messages.push({ role: "user", content: userMessage });

    const completion = await this.groqClient.chat.completions.create({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: messages as any,
      temperature: 0.3,
      max_tokens: 1024,
    });

    return {
      content: completion.choices[0]?.message?.content || "Kechirasiz, javob yaratishda xatolik yuz berdi.",
    };
  }

  private async callGemini(
    systemPrompt: string,
    context: string,
    conversationHistory: ChatMessage[],
    userMessage: string
  ): Promise<{ content: string }> {
    if (!this.geminiModel) throw new Error("Gemini not initialized");

    let prompt = systemPrompt + "\n\n";

    if (context) {
      prompt += `Context:\n${context}\n\n`;
    }

    if (conversationHistory.length > 0) {
      prompt += "Conversation history:\n";
      for (const msg of conversationHistory.slice(-6)) {
        if (msg.role !== "system") {
          prompt += `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}\n`;
        }
      }
      prompt += "\n";
    }

    prompt += `User: ${userMessage}\nAssistant: `;

    const result = await this.geminiModel.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    return {
      content: text || "Kechirasiz, javob yaratishda xatolik yuz berdi.",
    };
  }

  private async callOpenAI(
    systemPrompt: string,
    context: string,
    conversationHistory: ChatMessage[],
    userMessage: string
  ): Promise<{ content: string }> {
    if (!this.openaiClient) throw new Error("OpenAI not initialized");

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (context) {
      messages.push({ role: "system", content: `Context:\n${context}` });
    }

    for (const msg of conversationHistory.slice(-8)) {
      if (msg.role !== "system") {
        messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
      }
    }

    messages.push({ role: "user", content: userMessage });

    const completion = await this.openaiClient.chat.completions.create({
      model: process.env.LLM_MODEL || "gpt-4o-mini",
      messages: messages as any,
      temperature: 0.3,
      max_tokens: 1024,
    });

    return {
      content: completion.choices[0]?.message?.content || "Kechirasiz, javob yaratishda xatolik yuz berdi.",
    };
  }

  private getTemplateResponse(intent: string, toolResults: any[], message: string, language: string): string {
    const lower = message.toLowerCase();

    if (intent === "greeting" || lower.includes("salom") || lower.includes("assalom") || lower.includes("hello") || lower.includes("hi")) {
      if (language === "uz") {
        return `Assalomu alaykum! 😊 Men **Mentalaba AI** — O'zbekistondagi talabalar uchun yordamchi assistant.

Men sizga quyidagilarda yordam bera olaman:

🏛 **Universitetlar** — davlat, xususiy va xalqaro universitetlar haqida to'liq ma'lumot
📚 **Yo'nalishlar** — IT, tibbiyot, iqtisod, pedagogika va boshqa 50+ yo'nalish
💰 **Grantlar** — 100% grant, davlat granti, stipendiyalar
📰 **Yangiliklar** — so'nggi ta'lim yangiliklari va e'lonlar

Qaysi yo'nalish sizni qiziqtiradi? Qayerda o'qimoqchisiz? Savolingizni yozing, men sizga eng yaxshi variantlarni topib beraman.

👉 [Mentalaba.uz](https://mentalaba.uz) — barcha universitetlar katalogi`;
      } else if (language === "ru") {
        return `Здравствуйте! 😊 Я **Mentalaba AI** — помощник для студентов Узбекистана.

Я могу помочь вам с:

🏛 **Университеты** — государственные, частные и международные
📚 **Направления** — IT, медицина, экономика, педагогика и 50+ других
💰 **Гранты** — 100% гранты, стипендии
📰 **Новости** — последние новости образования

Какой у вас вопрос? Напишите, и я найду лучшие варианты для вас!

👉 [Mentalaba.uz](https://mentalaba.uz)`;
      } else {
        return `Hello! 😊 I'm **Mentalaba AI** — your assistant for students in Uzbekistan.

I can help you with:

🏛 **Universities** — state, private, and international universities
📚 **Programs** — IT, medicine, economics, pedagogy and 50+ more
💰 **Grants** — 100% grants, scholarships, stipends
📰 **News** — latest education news and announcements

What would you like to know? Write your question and I'll find the best options for you!

👉 [Mentalaba.uz](https://mentalaba.uz)`;
      }
    }

    if (toolResults.length > 0) {
      const firstResult = toolResults[0];
      if (firstResult.success && firstResult.data) {
        if (firstResult.tool === "search_university") {
          // Yangi format: { universities, universityOverview, regionOverview } yoki eski format: array
          const isOverviewFormat = !Array.isArray(firstResult.data) && firstResult.data?.universityOverview;
          const overview = isOverviewFormat ? firstResult.data.universityOverview : null;
          const regionOverview = isOverviewFormat ? firstResult.data.regionOverview : null;
          const data = isOverviewFormat
            ? (Array.isArray(firstResult.data.universities) ? firstResult.data.universities : [])
            : (Array.isArray(firstResult.data) ? firstResult.data : [firstResult.data]);

          // AGAR DATA TO'LIQ BO'SH BO'LSA (va overview/region yo'q), "0+" ko'rsatish o'rniga fallback
          const isEmpty = data.length === 0;

          // REGION OVERVIEW FORMATI — "Toshkentda nechta universitet?" yoki "xalqaro universitetlar bormi?"
          if (regionOverview?.regionSpecific) {
            const regionNames: Record<number, string> = {
              1: 'Qoraqalpogiston Respublikasi', 2: 'Andijon viloyati', 3: 'Buxoro viloyati',
              4: 'Jizzax viloyati', 5: 'Qashqadaryo viloyati', 6: 'Navoiy viloyati',
              7: 'Namangan viloyati', 8: 'Samarqand viloyati', 9: 'Surxondaryo viloyati',
              10: 'Sirdaryo viloyati', 11: 'Toshkent viloyati', 12: "Farg'ona viloyati",
              13: 'Xorazm viloyati', 14: 'Toshkent shahri', 15: 'Boshqa',
            };
            const rn = regionNames[regionOverview.regionId] || `Viloyat`;
            const rs = regionOverview.regionSpecific;

            // User so'rovida kategoriya (xalqaro/davlat/xususiy) bormi?
            const msgLower = message.toLowerCase();
            const askedInternational = /\bxalqaro\b/i.test(msgLower);
            const askedState = /\bdavlat\b/i.test(msgLower);
            const askedPrivate = /\bxususiy\b/i.test(msgLower);
            const askedYesNo = /\b(bormi|bormikan|mavjudmi)\b/i.test(msgLower);

            // Qaysi kategoriya so'ralgan?
            const askedCategory = askedInternational ? 'xalqaro' : askedState ? 'davlat' : askedPrivate ? 'xususiy' : null;
            // Shu kategoriyadagi universitetlar soni
            const categoryCount = askedInternational ? rs.international : askedState ? rs.state : askedPrivate ? rs.private : rs.total;
            const categoryLabel = askedCategory || 'universitet';
            const categoryIcon = askedInternational ? '🌍' : askedState ? '🏛' : askedPrivate ? '🏢' : '🏛';

            // HEADER: kategoriya aniqlangan bo'lsa, shunga mos header
            let response = '';
            if (askedYesNo) {
              // "bormi?" -> "Ha, ...da N ta xalqaro universitet bor!"
              response = `Ha, ${rn}da **${categoryCount} ta** ${categoryLabel} universitet bor! 🎉\n\n`;
            } else if (askedCategory) {
              // "... kerak" yoki "... qiziqaman" -> "Mana ${rn}dagi ${categoryLabel} universitetlar"
              response = `${categoryIcon} **Mana ${rn}dagi ${categoryLabel} universitetlar ro'yxati:**\n\n`;
            } else {
              // Umumiy savol -> eski format
              response = `### 🏛 ${rn} universitetlari\n\n${rn}da jami **${rs.total} ta** universitet mavjud! 🎉\n\n`;
            }

            // Turlari bo'yicha taqsimot (faqat umumiy savol bo'lsa, yoki ko'rsatish foydali)
            if (!askedCategory) {
              response += `**Turlari bo'yicha:**\n`;
              response += `🏛 **Davlat:** ${rs.state} ta\n`;
              response += `🏢 **Xususiy:** ${rs.private} ta\n`;
              if (rs.international > 0) response += `🌍 **Xalqaro:** ${rs.international} ta\n`;
            } else if (categoryCount > 0) {
              // Aniq kategoriya so'ralganda, sonni aytamiz
              response += `${categoryIcon} **${categoryLabel} universitetlar:** ${categoryCount} ta\n`;
            }

            // Universitetlar ro'yxati
            if (data.length > 0) {
              response += `\n**Ro'yxat:**\n`;
              data.slice(0, 10).forEach((uni: any, i: number) => {
                const icons = `${uni.hasGrant ? '💰' : ''}${uni.hasAccommodation ? '🏠' : ''}`.trim();
                response += `${i + 1}. **${uni.fullNameUz || uni.fullNameEn}** ${icons ? icons : ''}\n`;
                if (uni.slug) response += `   [🔍 Mentalaba.uz da ko'rish](https://mentalaba.uz/universities/${uni.slug})\n`;
              });
            }

            // SAVOL: kategoriya + region bo'lsa -> yo'nalishni so'raymiz
            // (keyingi qadam: foydalanuvchi yo'nalishni aytadi -> recommendation)
            if (askedCategory && data.length > 0) {
              response += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha universitetlar katalogi\n\n😊 Qanday yo'nalishga qiziqasiz? (IT, tibbiyot, iqtisod, pedagogika...)`;
            } else if (data.length > 0) {
              response += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha ${rs.total} ta universitet katalogi\n\n😊 Yuqoridagi universitetlardan qaysi biri haqida batafsil ma'lumot olishni xohlaysiz?`;
            } else {
              response += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha universitetlar katalogi\n\nYana qanday yordam kerak? 😊`;
            }
            return response;
          }

          // MUHIM: MA'LUMOT FORMATLARINI TO'G'RI TARTIBDA TEKSHIRISH:
          // 1. REGION overview (agar region so'ralgan bo'lsa) — yuqorida tekshirildi
          // 2. CATEGORY overview (xususiy/davlat/xalqaro, regionsiz)
          // 3. NATIONAL overview (agar umumiy savol bo'lsa: "nechta universitet bor?")
          //    -> data bo'lsa ham overview ko'rsatiladi!
          // 4. AGAR 1 TA UNIVERSITET BO'LSA -> single university format (batafsil)
          // 5. AGAR 2+ TA BO'LSA -> list format
          // 6. DATA BO'SH BO'LSA -> fallback
          //
          // BU MUHIM: "O'zbekistonda nechta universitet bor?" desa, overview (152 ta, kategoriyalar)
          // chiqishi kerak, 20 ta random universitet ro'yxati EMAS!
          //
          // CATEGORY OVERVIEW — "xususiy universitetlar", "davlat universitetlari" kabi
          // faqat kategoriya bo'yicha so'ralganda.
          // "menga xususiy universitetlar kerak" -> count + 3 ta misol + qaysi shahar?
          const msgLowerCat = message.toLowerCase();
          const catInternational = /\bxalqaro\b/i.test(msgLowerCat);
          const catState = /\bdavlat\b/i.test(msgLowerCat);
          const catPrivate = /\bxususiy\b/i.test(msgLowerCat) || /\bnodavlat\b/i.test(msgLowerCat);
          const askedCategoryOnly = (catInternational || catState || catPrivate) && overview && !regionOverview;

          if (askedCategoryOnly) {
            const catType = catInternational ? 'xalqaro' : catState ? 'davlat' : 'xususiy';
            const catIcons: Record<string, string> = { 'xalqaro': '🌍', 'davlat': '🏛', 'xususiy': '🏢' };
            const catCounts: Record<string, number> = {
              'xalqaro': overview.categories.international,
              'davlat': overview.categories.state,
              'xususiy': overview.categories.private,
            };
            const count = catCounts[catType];
            const icon = catIcons[catType];

            const catHeading = catType === 'xalqaro' ? 'Xalqaro' : catType === 'davlat' ? 'Davlat' : 'Xususiy';
            let response = `## ${icon} ${catHeading} universitetlar\n\n`;
            response += `O'zbekistonda jami **${count} ta** ${catType} universitet bor! 🎉\n\n`;

            if (data.length > 0) {
              response += `**Masalan:**\n`;
              data.slice(0, 3).forEach((uni: any) => {
                response += `• **${uni.fullNameUz || uni.fullNameEn}**`;
                if (uni.location) response += ` — ${uni.location}`;
                response += '\n';
              });
              response += '\n';
            }

            response += `📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha ${catType} universitetlar katalogi\n\nSizga qaysi shahardan kerak yoki qanday yo'nalishga qiziqasiz? 😊`;
            return response;
          }

          // NATIONAL OVERVIEW — agar mavjud bo'lsa va ANIQ universitet so'ralmagan bo'lsa
          // "nechta universitet bor?", "jami nechta?", "O'zbekistondagi universitetlar" kabi
          // umumiy savollarga overview formatida javob beramiz.
          const isGeneralQuery = !isEmpty && overview && !regionOverview;
          if (isGeneralQuery) {
            let response = `### 🏛 O'zbekistondagi universitetlar\n\n`;
            response += `Jami **${overview.totalCount} ta** universitet mavjud! 🎉\n\n`;
            response += `**Turlari bo'yicha:**\n`;
            response += `🏛 **Davlat universitetlari:** ${overview.categories.state} ta\n`;
            response += `🏢 **Xususiy universitetlar:** ${overview.categories.private} ta\n`;
            response += `🌍 **Xalqaro universitetlar:** ${overview.categories.international} ta\n`;
            if (overview.universityExamples?.length) {
              response += `\n**Masalan:**\n`;
              overview.universityExamples.slice(0, 6).forEach((ex: any) => {
                const icon = ex.type === 'davlat' ? '🏛' : ex.type === 'xususiy' ? '🏢' : '🌍';
                response += `${icon} [${ex.name}](https://mentalaba.uz/universities/${ex.slug}) — ${ex.type}\n`;
              });
            }
            response += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha ${overview.totalCount} universitet katalogi\n\nYana qanday yordam kerak? Masalan, ma'lum bir shahar yoki yo'nalish bo'yicha universitetlarni ko'rishni xohlaysizmi? 😊`;
            return response;
          }

          // Agar aniq ma'lumot BO'LSA -> single university yoki list format
          if (!isEmpty) {
            if (data.length === 1) {
              const uni = data[0];
              const slug = uni.slug || '';
              let response = `## 🏛 ${uni.fullNameUz || uni.fullNameEn}\n\n`;
              response += `${uni.descriptionUz ? uni.descriptionUz.substring(0, 300) : ''}\n\n`;
              response += `**📋 Asosiy ma'lumotlar:**\n`;
              if (uni.institutionCategory) response += `• **Turi:** ${uni.institutionCategory}\n`;
              if (uni.location) response += `• **Manzil:** ${uni.location}\n`;
              if (uni.foundedYear) response += `• **Tashkil etilgan:** ${uni.foundedYear}\n`;
              if (uni.studentsCount) response += `• **Talabalar soni:** ~${Math.round(uni.studentsCount / 1000)}k\n`;
              if (uni.directionCount) response += `• **📚 Yo'nalishlar soni:** ${uni.directionCount} ta\n`;
              if (uni.hasGrant !== undefined) response += `${uni.hasGrant ? '✅' : '❌'} **Grant:** ${uni.hasGrant ? 'Mavjud' : 'Yo\'q'}\n`;
              if (uni.tuition && uni.tuition !== 'N/A') response += `💰 **To'lov:** ${uni.tuition}\n`;
              if (uni.hasAccommodation !== undefined) response += `${uni.hasAccommodation ? '✅' : '❌'} **Yotoqxona:** ${uni.hasAccommodation ? 'Bor' : 'Yo\'q'}\n`;
              if (uni.phone) response += `📞 **Telefon:** ${uni.phone}\n`;
              if (uni.website) response += `🌐 **Sayt:** ${uni.website}\n`;
              if (uni.educationTypes?.length > 0) response += `🎓 **Ta'lim shakllari:** ${uni.educationTypes.map((e: any) => e.name).join(', ')}\n`;
              if (uni.degrees?.length > 0) response += `📜 **Darajalar:** ${uni.degrees.map((d: any) => d.name).join(', ')}\n`;
              if (uni.educationLanguages?.length > 0) response += `🌐 **Ta'lim tillari:** ${uni.educationLanguages.map((l: any) => l.name).join(', ')}\n`;
              if (uni.admissionPhone && uni.admissionPhone !== uni.phone) response += `📞 **Qabul telefon:** ${uni.admissionPhone}\n`;
              if (uni.isOpenForAdmission !== undefined) response += `${uni.isOpenForAdmission ? '✅' : '❌'} **Qabul:** ${uni.isOpenForAdmission ? 'Ochiq' : 'Yopiq'}\n`;
              response += `\n📌 **[Mentalaba.uz da batafsil ko'rish](https://mentalaba.uz/universities/${slug})** — barcha yo'nalishlar, grantlar va qabul shartlari\n\n😊 Yana biror universitet haqida ma'lumot kerakmi yoki qo'shimcha savolingiz bormi?`;
              return response;
            }

            // LIST FORMATI — data.length >= 2
            let response = "### 🏛 Universitetlar ro'yxati\n\n";
            response += "Mana sizga mos keladigan universitetlar:\n\n";
            data.slice(0, 10).forEach((uni: any, i: number) => {
              const icons = `${uni.hasGrant ? '💰' : ''}${uni.hasAccommodation ? '🏠' : ''}`.trim();
              response += `${i + 1}. **${uni.fullNameUz || uni.fullNameEn}** ${uni.location ? `— ${uni.location}` : ''} ${icons ? icons : ''}\n`;
              if (uni.slug) {
                response += `   [🔍 Mentalaba.uz da ko'rish](https://mentalaba.uz/universities/${uni.slug})\n`;
              }
            });
            response += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha ${data.length} ta universitetlar katalogi\n\nQaysi biriga batafsil qarashni xohlaysiz? 😊`;
            return response;
          }

          // DATA BO'SH BO'LSA -> overview yoki fallback
          if (overview) {
            let response = "### 🏛 O'zbekistondagi universitetlar\n\n";
            response += `Jami **${overview.totalCount} ta** universitet mavjud! 🎉\n\n`;
            response += `**Turlari bo'yicha:**\n`;
            response += `🏛 **Davlat universitetlari:** ${overview.categories.state} ta\n`;
            response += `🏢 **Xususiy universitetlar:** ${overview.categories.private} ta\n`;
            response += `🌍 **Xalqaro universitetlar:** ${overview.categories.international} ta\n`;
            if (overview.universityExamples?.length) {
              response += `\n**Masalan:**\n`;
              overview.universityExamples.slice(0, 6).forEach((ex: any) => {
                const icon = ex.type === 'davlat' ? '🏛' : ex.type === 'xususiy' ? '🏢' : '🌍';
                response += `${icon} [${ex.name}](https://mentalaba.uz/universities/${ex.slug}) — ${ex.type}\n`;
              });
            }
            response += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha ${overview.totalCount} universitet katalogi\n\nYana qanday yordam kerak? Masalan, ma'lum bir shahar yoki yo'nalish bo'yicha universitetlarni ko'rishni xohlaysizmi? 😊`;
            return response;
          }

          // Hech narsa topilmadi -> fallback
          return `Kechirasiz, sizning so'rovingiz bo'yicha universitet topilmadi. 😔\n\nIltimos, boshqa shartlar yoki hudud bo'yicha qidirib ko'ring.\n\n📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha universitetlar katalogi\n\nYana qanday yordam kerak? 😊`;
        }

        if (firstResult.tool === "search_direction") {
          const directionsData = Array.isArray(firstResult.data)
            ? { directions: firstResult.data, universities: [], tuitionInfo: undefined, universityDirections: undefined }
            : firstResult.data;
          const data = Array.isArray(directionsData.directions) ? directionsData.directions : [];
          const uniList = Array.isArray(directionsData.universities) ? directionsData.universities : [];
          const uniDir = directionsData.universityDirections;
          const tuitionInfo = directionsData.tuitionInfo;

          // FORMAT 1 — aniq bitta universitet nomi bo'yicha so'ralganda
          // ("Samarqand davlat universitetida qanday yo'nalishlar bor?")
          // — barcha yo'nalish nomlarini to'liq ro'yxat qilib ko'rsatamiz
          if (uniDir && uniDir.directionNames?.length > 0) {
            let response = `### 📚 ${uniDir.universityName} yo'nalishlari\n\n`;
            response += `Jami **${uniDir.totalCount} ta** yo'nalish mavjud! 🎉\n\n`;
            response += `**To'liq ro'yxat:**\n`;
            uniDir.directionNames.slice(0, 30).forEach((name: string, i: number) => {
              response += `${i + 1}. ${name}\n`;
            });
            if (uniDir.directionNames.length > 30) {
              response += `\n... va yana ${uniDir.directionNames.length - 30} ta yo'nalish\n`;
            }
            if (uniDir.universitySlug) {
              response += `\n📌 **[Mentalaba.uz da batafsil](https://mentalaba.uz/universities/${uniDir.universitySlug})** — qabul shartlari, grantlar va kontrakt narxlari\n`;
            }
            response += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/directions)** — barcha yo'nalishlar katalogi\n\nYana qanday yordam kerak? 😊`;
            return response;
          }

          if (data.length === 0) {
            return "Kechirasiz, sizning so'rovingiz bo'yicha yo'nalish topilmadi. 😔 Boshqa soha yoki shaharni ko'raylikmi?";
          }

          // FORMAT 2 — soha bo'yicha qidiruv ("IT ga qiziqaman, qaysi universitet mos?")
          // MUHIM: bu yerda mos universitetlarning TO'LIQ ma'lumoti (tavsif, narx, kontakt, sayt)
          // bor bo'lsa, faqat nom emas — ularni to'liq ko'rsatamiz.
          if (uniList.length > 0) {
            let response = "### 🎓 Sizga mos universitetlar\n\n";
            response += `"${message}" so'roviga mos **${uniList.length} ta** universitet topildi! 🎉\n\n`;

            uniList.slice(0, 5).forEach((uni: any, i: number) => {
              response += `---\n\n`;
              response += `**${i + 1}. ${uni.fullNameUz || uni.fullNameEn}**\n\n`;
              if (uni.descriptionUz) {
                const shortDesc = uni.descriptionUz.substring(0, 250) + (uni.descriptionUz.length > 250 ? '...' : '');
                response += `${shortDesc}\n\n`;
              }
              if (uni.institutionCategory) response += `📋 **Turi:** ${uni.institutionCategory}\n`;
              if (uni.location) response += `📍 **Manzil:** ${uni.location}\n`;
              response += `${uni.hasGrant ? '✅' : '❌'} **Grant:** ${uni.hasGrant ? 'Mavjud' : 'Yo\'q'}\n`;
              response += `${uni.hasAccommodation ? '✅' : '❌'} **Yotoqxona:** ${uni.hasAccommodation ? 'Bor' : 'Yo\'q'}\n`;
              if (uni.tuition && uni.tuition !== 'N/A') response += `💰 **To'lov:** ${uni.tuition}\n`;
              if (uni.phone) response += `📞 **Telefon:** ${uni.phone}\n`;
              if (uni.website) response += `🌐 **Sayt:** ${uni.website}\n`;
              response += `${uni.isOpenForAdmission ? '✅' : '❌'} **Qabul:** ${uni.isOpenForAdmission ? 'Ochiq' : 'Yopiq'}\n`;
              if (uni.slug) response += `[🔍 Mentalaba.uz da batafsil ko'rish](https://mentalaba.uz/universities/${uni.slug})\n`;
              response += `\n`;
            });

            // Shu universitetlardagi mos yo'nalishlar nomlarini ham qo'shamiz
            const dirsForShownUnis = data.filter((d: any) =>
              uniList.slice(0, 5).some((u: any) => u.id === d.universityId)
            );
            if (dirsForShownUnis.length > 0) {
              response += `---\n\n**📚 Mos yo'nalishlar:**\n`;
              dirsForShownUnis.slice(0, 10).forEach((dir: any) => {
                response += `• ${dir.nameUz || dir.nameEn} — *${dir.universityName}*\n`;
              });
              response += `\n`;
            }

            if (tuitionInfo?.hasData) {
              response += `💰 **Umumiy narx oralig'i:** ${(tuitionInfo.minTuition / 1000000).toFixed(0)} - ${(tuitionInfo.maxTuition / 1000000).toFixed(0)} mln so'm\n\n`;
            }

            response += `📌 **[Mentalaba.uz](https://mentalaba.uz/directions)** — barcha yo'nalishlar katalogi\n\nQaysi biriga batafsil qarashni xohlaysiz? 😊`;
            return response;
          }

          // FORMAT 3 — fallback: faqat yo'nalish nomlari bor, universitet to'liq ma'lumoti yo'q
          let response = "### 📚 Yo'nalishlar\n\n";
          response += "Mana bir nechta variantlar:\n\n";
          data.slice(0, 8).forEach((dir: any, i: number) => {
            response += `${i + 1}. **${dir.nameUz || dir.nameEn}** ${dir.universityName ? `— ${dir.universityName}` : ''}\n`;
          });

          if (tuitionInfo?.hasData && tuitionInfo.universities.length > 0) {
            response += `\n💰 **Kontrakt narxlari:** ${(tuitionInfo.minTuition / 1000000).toFixed(0)} - ${(tuitionInfo.maxTuition / 1000000).toFixed(0)} mln so'm (universitetga qarab)\n`;
            response += `   Masalan: `;
            response += tuitionInfo.universities.map((u: any) =>
              `[${u.name}](${u.slug ? `https://mentalaba.uz/universities/${u.slug}` : 'https://mentalaba.uz/universities'}) - ${u.tuition}`
            ).join(', ');
            response += `\n`;
          }

          response += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/directions)** — barcha yo'nalishlar katalogi\n\nYana qanday yo'nalishlar qiziqtiradi? Yoki ma'lum bir universitet bo'yicha ko'rishni xohlaysizmi? 😊`;
          return response;
        }

        if (firstResult.tool === "search_grants") {
          const data = Array.isArray(firstResult.data) ? firstResult.data : [firstResult.data];
          if (data.length === 0) return "Kechirasiz, hozircha faol grantlar topilmadi. 😔 Yangi grantlar e'lon qilinganda xabar beramiz!\n\n📌 **[Mentalaba.uz](https://mentalaba.uz/grants)** — grantlar bo'limi\n\nYana qanday yordam kerak?";
          let response = "### 💰 Grantlar\n\n";
          response += "Ajoyib! Sizga mos grantlar topildi 🎉\n\n";
          data.slice(0, 5).forEach((grant: any, i: number) => {
            response += `${i + 1}. **${grant.grantTitleUz || grant.grantTitleEn}**\n`;
            if (grant.universityNameUz) response += `   • **Universitet:** ${grant.universityNameUz}\n`;
            if (grant.grantDescUz) response += `   • ${grant.grantDescUz.substring(0, 200)}...\n`;
          });
          response += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/grants)** — barcha grantlar\n\nYana biror narsa bo'yicha yordam kerakmi? 😊`;
          return response;
        }

        if (firstResult.tool === "compare_universities") {
          const data = Array.isArray(firstResult.data) ? firstResult.data : [firstResult.data];
          if (data.length === 0) return "Kechirasiz, taqqoslash uchun ma'lumot topilmadi. 😔";
          let response = "### ⚖️ Universitetlarni taqqoslash\n\n";
          response += "Mana siz uchun solishtirma jadval:\n\n";
          data.slice(0, 5).forEach((uni: any, i: number) => {
            response += `**${i + 1}. ${uni.name}**\n`;
            response += `📌 [Mentalaba.uz da ko'rish](https://mentalaba.uz/universities/${uni.slug || ''})\n`;
            response += `| **Turi** | ${uni.type || 'N/A'} |\n`;
            response += `| **Manzil** | ${uni.location || 'N/A'} |\n`;
            response += `| **💰 Grant** | ${uni.hasGrant ? '✅ Mavjud' : '❌ Yo\'q'} |\n`;
            response += `| **🏠 Yotoqxona** | ${uni.hasAccommodation ? '✅ Bor' : '❌ Yo\'q'} |\n`;
            response += `| **💵 To'lov** | ${uni.tuition || 'N/A'} |\n`;
            response += `| **📚 Yo'nalishlar** | ${uni.directionCount || 'N/A'} ta |\n`;
            response += `| **🎓 Talabalar** | ${uni.studentsCount ? `~${Math.round(uni.studentsCount / 1000)}k` : 'N/A'} |\n`;
            response += `| **🚪 Qabul** | ${uni.isOpenForAdmission ? '✅ Ochiq' : '❌ Yopiq'} |\n`;
            response += `\n`;
          });
          response += `📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha universitetlar katalogi\n\nQaysi biriga batafsil qarashni xohlaysiz? 😊`;
          return response;
        }

        if (firstResult.tool === "recommend") {
          const data = firstResult.data;

          // Agar clarification kerak bo'lsa — foydalanuvchiga savol beramiz
          if (data?.needsClarification) {
            let response = "### 🎯 Sizga eng yaxshi variantni topaman!\n\n";
            response += "Keling, bir necha savolga javob bering:\n\n";

            const missing = data.preferences?.missing || [];

            if (missing.includes('region')) {
              response += "1️⃣ **Qaysi shahar yoki viloyatda o'qimoqchisiz?** (Toshkent, Samarqand, Buxoro...)\n";
            }
            if (missing.includes('directionCategory')) {
              response += "2️⃣ **Qanday yo'nalish sizni qiziqtiradi?** (IT, tibbiyot, iqtisod, pedagogika, huquq...)\n";
              if (!missing.includes('region')) {
                response += "Masalan: IT, tibbiyot, iqtisod, muhandislik, pedagogika, huquq...\n";
              }
            }
            if (missing.includes('institutionCategory')) {
              response += "3️⃣ **Davlatmi yoki xususiy universitetmi?**\n";
            }

            response += "\n📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha universitetlar\n\nJavob bering, men sizga eng yaxshi variantlarni tavsiya qilaman! 😊";
            return response;
          }

          // Natijalar mavjud — rekomendatsiyalarni ko'rsatamiz
          if (data?.recommendations?.length > 0) {
            let response = "### 🎯 Siz uchun eng yaxshi tavsiyalar!\n\n";
            response += `Sizning xohishingiz bo'yicha **${data.recommendations.length} ta** universitet topildi! 🎉\n\n`;

            const prefs = data.preferences || {};
            if (prefs.directionCategory) {
              response += `📚 **Yo'nalish:** ${prefs.directionCategory.toUpperCase()}\n`;
            }
            if (prefs.institutionCategory) {
              const typeNames: Record<string, string> = { '3': '🏛 Davlat', '4': '🏢 Xususiy', '5': '🌍 Xalqaro' };
              response += `${typeNames[prefs.institutionCategory] || ''} universitetlar\n`;
            }
            response += `\n`;

            data.recommendations.forEach((uni: any, i: number) => {
              const icons = `${uni.hasGrant ? '💰' : ''}${uni.hasAccommodation ? '🏠' : ''}`.trim();
              response += `**${i + 1}. ${uni.fullNameUz || uni.fullNameEn}** ${icons ? icons : ''}\n`;
              if (uni.location) response += `   📍 *${uni.location}*\n`;
              if (uni.tuition && uni.tuition !== 'N/A') response += `   💵 *${uni.tuition}*\n`;
              if (uni.slug) response += `   [🔍 Mentalaba.uz da ko'rish](https://mentalaba.uz/universities/${uni.slug})\n`;
              if (uni.descriptionUz) {
                const shortDesc = uni.descriptionUz.substring(0, 150) + (uni.descriptionUz.length > 150 ? '...' : '');
                response += `   ${shortDesc}\n`;
              }
              response += `\n`;
            });

            if (data.directions?.length > 0) {
              response += `**📚 Topilgan yo'nalishlar:** ${data.directions.length} ta\n`;
              data.directions.slice(0, 8).forEach((d: any, i: number) => {
                response += `${i + 1}. ${d.nameUz || d.nameEn} — ${d.universityName}\n`;
              });
              response += `\n`;
            }

            if (data.grants?.length > 0) {
              response += `**💰 Grantlar:** ${data.grants.length} ta topildi!\n`;
              data.grants.slice(0, 3).forEach((g: any) => {
                response += `- ${g.grantTitleUz || g.grantTitleEn}\n`;
              });
              response += `\n`;
            }

            response += `📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha universitetlar katalogi\n\nQaysi biriga batafsil qarashni xohlaysiz? 😊`;
            return response;
          }

          return "Kechirasiz, sizning talabingizga mos universitet topilmadi. 😔 Iltimos, boshqa parametrlarni tanlab ko'ring.";
        }

        if (firstResult.tool === "search_news") {
          const data = Array.isArray(firstResult.data) ? firstResult.data : [firstResult.data];
          if (data.length === 0) return "Kechirasiz, hozircha yangiliklar topilmadi. 😔";
          let response = "### 📰 So'nggi yangiliklar\n\n";
          data.slice(0, 5).forEach((news: any, i: number) => {
            response += `${i + 1}. **${news.titleUz || news.titleEn}**\n`;
            if (news.descriptionUz) response += `   ${news.descriptionUz.substring(0, 150)}...\n`;
          });
          response += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/news)** — barcha yangiliklar\n\nYana qanday ma'lumot kerak? 😊`;
          return response;
        }
      }
    }

    // Agar DATA INTENT bo'lsa (tool empty/failed bo'lsa ham), data-spesifik xabar qaytaramiz
    // BU MUHIM: direction_search empty bo'lganda greeting yoki generic fallback chiqmasligi kerak!
    if (intent === "direction_search") {
      return `Kechirasiz, sizning so'rovingiz bo'yicha yo'nalish topilmadi. 😔\n\nIltimos, boshqa soha yoki shaharni ko'raylikmi? Masalan:\n• 📚 "IT yo'nalishlari"\n• 💰 "Grantlar bormi"\n• 🏛 "Toshkentdagi universitetlar"\n\nYoki menga o'z xohishingizni ayting!`;
    }
    if (intent === "grant_search") {
      return "Kechirasiz, hozircha faol grantlar topilmadi. 😔 Yangi grantlar e'lon qilinganda xabar beramiz!\n\n📌 **[Mentalaba.uz](https://mentalaba.uz/grants)** — grantlar bo'limi";
    }
    if (intent === "news_search") {
      return "Kechirasiz, hozircha yangiliklar topilmadi. 😔\n\n📌 **[Mentalaba.uz](https://mentalaba.uz/news)** — yangiliklar bo'limi";
    }

    // Agar hech qanday ma'lumot topilmasa, rekomendatsiya so'raymiz
    if (lower.includes("qaysi") || lower.includes("tanlasam") || lower.includes("bilmayman") || lower.includes("yaxshisi") || lower.includes("maslahat")) {
      if (language === "uz") {
        return `Tushunaman! 😊 Sizga mos variantni topishga yordam beraman. Keling, bir necha savolga javob bering:

1️⃣ **Qaysi shahar yoki viloyatda o'qimoqchisiz?** (Toshkent, Samarqand, Buxoro...)
2️⃣ **Qanday yo'nalishlarga qiziqasiz?** (IT, tibbiyot, iqtisod, pedagogika, huquq...)
3️⃣ **Davlatmi yoki xususiy universitetmi?**
4️⃣ **Grant qiziqtiradimi?**

Shu ma'lumotlar asosida sizga eng yaxshi variantlarni tavsiya qilaman! 🎯`;
      } else if (language === "ru") {
        return `Понимаю! 😊 Давайте помогу найти лучший вариант. Ответьте на несколько вопросов:

1️⃣ **В каком городе или регионе хотите учиться?** (Ташкент, Самарканд, Бухара...)
2️⃣ **Какие направления вас интересуют?** (IT, медицина, экономика, педагогика, право...)
3️⃣ **Государственный или частный университет?**
4️⃣ **Грант интересует?**

На основе этих данных я порекомендую лучшие варианты! 🎯`;
      } else {
        return `I understand! 😊 Let me help you find the best option. Answer a few questions:

1️⃣ **Which city or region would you like to study in?** (Tashkent, Samarkand, Bukhara...)
2️⃣ **What field interests you?** (IT, medicine, economics, pedagogy, law...)
3️⃣ **State or private university?**
4️⃣ **Are you interested in grants?**

Based on this, I'll recommend the best options for you! 🎯`;
      }
    }

    return this.getFallbackResponse(message, language);
  }

  private getFallbackResponse(message: string, language: string): string {
    if (language === "uz") {
      return 'Kechirasiz, hozircha bu ma\'lumotni topa olmadim.\n\nEhtimol, savolingizni boshqacha yozib ko\'ring. Masalan:\n\n- "Toshkentdagi davlat universitetlari"\n- "IT yo\'nalishlari"\n- "Grantlar bormi"\n- "So\'nggi yangiliklar"\n\nYoki menga nima izlayotganingizni yozing, men sizga yordam beraman.\n\n📌 [Mentalaba.uz](https://mentalaba.uz) — barcha imkoniyatlar';
    }

    if (language === "ru") {
      return 'Извините, не удалось найти эту информацию.\n\nПопробуйте переформулировать вопрос, например:\n\n- "Государственные университеты Ташкента"\n- "IT направления"\n- "Есть ли гранты"\n- "Последние новости"\n\nРасскажите, что вы ищете, и я помогу найти лучший вариант.\n\n📌 [Mentalaba.uz](https://mentalaba.uz) — все возможности';
    }

    return 'Sorry, I couldn\'t find this information.\n\nTry rephrasing your question, for example:\n\n- "State universities in Tashkent"\n- "IT programs"\n- "Are there grants"\n- "Latest news"\n\nOr tell me what you\'re looking for and I\'ll help find the best option.\n\n📌 [Mentalaba.uz](https://mentalaba.uz) — all opportunities';
  }
}

export const providerManager = new ProviderManager();