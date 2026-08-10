import OpenAI from "openai";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import type { ChatMessage, IntentResult } from "@/types";
import { contextBuilder } from "./context-builder";
import { intentClassifier } from "./intent-classifier";
import { toolRouter } from "./tool-router";
import { embeddingService } from "./embedding-service";
import { augmentFollowUp, updateRecommendationProfile } from "./follow-up-context";
import { getIntentDataFlag, getIntentResponseStrategy } from "./intent-config";
import { buildEntityExtractionPrompt, parseEntitiesJSON } from "./llm-entity-extractor";
import { responseBuilder } from "./formatter";
import { detectRequestField, isBareFieldRequest, requestFieldLabel } from "./request-field";
import { universityClarificationResponse } from "./formatter/common";
import { buildCompactContext } from "./compact-context";
import { buildSnapshotHistory } from "./compact-history";
import { responseCache } from "./response-cache";
import { logAnalytics } from "./analytics";

/**
 * Promise'ni timeout bilan o'rab oladi. Kechikkan xato unhandled rejection
 * bo'lmasligi uchun ichki .catch() qo'shilgan — timeout yoki xato → null.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  return Promise.race([
    promise.catch((e: any) => {
      console.warn(`[LLM Entities] ${label} xato: ${e?.message || e}`);
      return null;
    }),
    new Promise<T | null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export type AIProvider = "groq" | "openrouter" | "deepseek" | "gemini" | "openai";

class ProviderManager {
  private groqClient: OpenAI | null = null;
  private openRouterClient: OpenAI | null = null;
  private deepseekClient: OpenAI | null = null;
  private geminiModel: GenerativeModel | null = null;
  private openaiClient: OpenAI | null = null;
  private activeProvider: AIProvider = "groq";
  private initialized = false;

  /**
   * CIRCUIT BREAKER (umumiy): qaysi provider 429 / "Insufficient Balance" /
   * "quota" xatosi bersa, o'sha provider 2 daqiqaga o'tkazib yuboriladi —
   * so'rovlar avtomatik keyingi provider'ga boradi.
   * 2 daqiqadan keyin o'sha provider qayta urinib ko'riladi (limit/balans
   * tiklanganda avtomatik ishlay boshlaydi).
   */
  private circuitUntil: Partial<Record<AIProvider, number>> = {};

  /** Provider hozircha o'tkazib yuborilishi kerakmi? (limit xatosi bo'lgan bo'lsa 2 daqiqa) */
  private shouldSkipProvider(name: AIProvider): boolean {
    return (this.circuitUntil[name] || 0) > Date.now();
  }

  /** Provider limit xatosi berganida chaqiriladi — 2 daqiqaga circuit ochamiz */
  private openCircuit(name: AIProvider): void {
    this.circuitUntil[name] = Date.now() + 2 * 60 * 1000;
    console.log(`[CircuitBreaker] ${name} limit xatosi — 2 daqiqa o'tkazib yuboriladi`);
  }

  /** 429 / rate limit / quota / insufficient balance — limit xatosi ekanini aniqlaydi */
  private isLimitError(error: any): boolean {
    const msg = (error?.message || "") + " " + JSON.stringify(error?.response?.data || {});
    return /429|rate ?limit|quota|insufficient|balance/i.test(msg);
  }

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
        name: "openrouter",
        displayName: "OpenRouter (100+ models)",
        configured: !!process.env.OPENROUTER_API_KEY,
        freeTier: false,
      },
      {
        name: "deepseek",
        displayName: "DeepSeek (V4)",
        configured: !!process.env.DEEPSEEK_API_KEY,
        freeTier: false,
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

  /**
   * BOSQICH 5: LLM-assisted entity extraction.
   *
   * Provider mavjud bo'lganda message'dan entity'larni LLM orqali ajratadi
   * (structured JSON output). Xato/timeout/provider yo'q bo'lsa null qaytaradi —
   * rule-based natija fallback sifatida saqlanadi (intentClassifier.extractEntities).
   *
   * @returns IntentResult['entities'] yoki null (xato / timeout / hech narsa topilmadi)
   */
  async extractEntitiesWithLLM(
    message: string,
    language: "uz" | "ru" | "en" = "uz"
  ): Promise<IntentResult["entities"] | null> {
    if (!this.initialized) {
      console.log("[LLM Entities] Provider yo'q — rule-based ishlatiladi");
      return null;
    }

    const prompt = buildEntityExtractionPrompt(message, language);

    // Groq birinchi (eng tez, free)
    // MUHIM: parsed !== null bo'lsa darhol qaytamiz (bo'sh {} ham) — muvaffaqiyatli
    // parse boshqa provider'larni urishni talab qilmaydi (bo'sh merge = no-op).
    if (this.groqClient && !this.shouldSkipProvider("groq")) {
      const text = await withTimeout(this.callGroqForEntities(prompt), 6000, "Groq");
      const parsed = text ? parseEntitiesJSON(text, message) : null;
      if (parsed !== null) {
        console.log(`[LLM Entities] Groq orqali: ${JSON.stringify(parsed)}`);
        return parsed;
      }
    }

    // OpenRouter (zaxira — Groq limiti tugaganda)
    if (this.openRouterClient && !this.shouldSkipProvider("openrouter")) {
      const text = await withTimeout(this.callOpenRouterForEntities(prompt), 6000, "OpenRouter");
      const parsed = text ? parseEntitiesJSON(text, message) : null;
      if (parsed !== null) {
        console.log(`[LLM Entities] OpenRouter orqali: ${JSON.stringify(parsed)}`);
        return parsed;
      }
    }

    // DeepSeek (zaxira — OpenRouter ham tugasa)
    if (this.deepseekClient && !this.shouldSkipProvider("deepseek")) {
      const text = await withTimeout(this.callDeepSeekForEntities(prompt), 6000, "DeepSeek");
      const parsed = text ? parseEntitiesJSON(text, message) : null;
      if (parsed !== null) {
        console.log(`[LLM Entities] DeepSeek orqali: ${JSON.stringify(parsed)}`);
        return parsed;
      }
    }

    // Gemini (free backup)
    if (this.geminiModel && !this.shouldSkipProvider("gemini")) {
      const text = await withTimeout(this.callGeminiForEntities(prompt), 6000, "Gemini");
      const parsed = text ? parseEntitiesJSON(text, message) : null;
      if (parsed !== null) {
        console.log(`[LLM Entities] Gemini orqali: ${JSON.stringify(parsed)}`);
        return parsed;
      }
    }

    // OpenAI (oxirgi)
    if (this.openaiClient && !this.shouldSkipProvider("openai")) {
      const text = await withTimeout(this.callOpenAIForEntities(prompt), 6000, "OpenAI");
      const parsed = text ? parseEntitiesJSON(text, message) : null;
      if (parsed !== null) {
        console.log(`[LLM Entities] OpenAI orqali: ${JSON.stringify(parsed)}`);
        return parsed;
      }
    }

    console.warn("[LLM Entities] Hech qanday provider natija bermadi — rule-based saqlanadi");
    return null;
  }

  /** Groq — structured JSON output (OpenAI-compatible) */
  private async callGroqForEntities(prompt: string): Promise<string> {
    if (!this.groqClient) throw new Error("Groq not initialized");
    const completion = await this.groqClient.chat.completions.create({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are a precise entity extractor. Respond with valid JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 400,
      response_format: { type: "json_object" },
    });
    return completion.choices[0]?.message?.content || "";
  }

  /** OpenRouter — structured JSON output (OpenAI-compatible) */
  private async callOpenRouterForEntities(prompt: string): Promise<string> {
    if (!this.openRouterClient) throw new Error("OpenRouter not initialized");
    const completion = await this.openRouterClient.chat.completions.create({
      model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a precise entity extractor. Respond with valid JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 400,
      response_format: { type: "json_object" },
    });
    return completion.choices[0]?.message?.content || "";
  }

  /** DeepSeek — structured JSON output (OpenAI-compatible) */
  private async callDeepSeekForEntities(prompt: string): Promise<string> {
    if (!this.deepseekClient) throw new Error("DeepSeek not initialized");
    const completion = await this.deepseekClient.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages: [
        { role: "system", content: "You are a precise entity extractor. Respond with valid JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 400,
      response_format: { type: "json_object" },
    });
    return completion.choices[0]?.message?.content || "";
  }

  /** Gemini — structured JSON output */
  private async callGeminiForEntities(prompt: string): Promise<string> {
    if (!this.geminiModel) throw new Error("Gemini not initialized");
    const result = await this.geminiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 400 },
    });
    return result.response.text();
  }

  /** OpenAI — structured JSON output */
  private async callOpenAIForEntities(prompt: string): Promise<string> {
    if (!this.openaiClient) throw new Error("OpenAI not initialized");
    const completion = await this.openaiClient.chat.completions.create({
      model: process.env.LLM_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a precise entity extractor. Respond with valid JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 400,
      response_format: { type: "json_object" },
    });
    return completion.choices[0]?.message?.content || "";
  }

  /**
   * AI'ni o'chirish tugmasi — API key'lar o'chirilmasdan template rejimda ishlash.
   * `.env` da `AI_MODE=template` yoki `DISABLE_AI=true` bo'lsa provider'lar init
   * qilinmaydi va barcha javoblar template (shablon) orqali qaytadi.
   *
   * Key'lar .env da turgani uchun boshqa vaqt `AI_MODE` ni o'chirish kifoya —
   * AI yana ishlaydi.
   */
  isAIDisabled(): boolean {
    const mode = (process.env.AI_MODE || "").trim().toLowerCase();
    const disable = (process.env.DISABLE_AI || "").trim().toLowerCase();
    return mode === "template" || mode === "off" || mode === "0" || disable === "true" || disable === "1";
  }

  init() {
    // AI o'chirilgan bo'lsa — provider'larni init QILMAYMIZ (template rejim)
    if (this.isAIDisabled()) {
      this.initialized = false;
      console.log("[Provider] AI o'chirilgan (AI_MODE=template) — template rejim");
      return;
    }

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

    // Initialize OpenRouter (OpenAI-compatible, 100+ modellar)
    if (process.env.OPENROUTER_API_KEY) {
      this.openRouterClient = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": "https://mentalaba.uz",
          "X-Title": "Mentalaba AI Agent",
        },
      });
      if (!this.initialized) {
        this.activeProvider = "openrouter";
        this.initialized = true;
      }
      console.log("[Provider] OpenRouter initialized");
    }

    // Initialize DeepSeek (OpenAI-compatible, V4 modellar)
    if (process.env.DEEPSEEK_API_KEY) {
      this.deepseekClient = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: "https://api.deepseek.com",
      });
      if (!this.initialized) {
        this.activeProvider = "deepseek";
        this.initialized = true;
      }
      console.log("[Provider] DeepSeek initialized");
    }

    // Initialize Gemini
    if (process.env.GEMINI_API_KEY) {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.geminiModel = genAI.getGenerativeModel({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
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

  /**
   * ANALYTICS WRAPPER (BOSQICH 7): har bir so'rov uchun
   * intent/strategy/provider/latency/success/fallback/tool log qiladi.
   */
  async generateResponse(
    userMessage: string,
    sessionContext: any,
    conversationHistory: ChatMessage[],
    language: "uz" | "ru" | "en" = "uz"
  ): Promise<{ content: string; intent?: string; toolUsed?: string; provider?: string; auth_required?: boolean }> {
    const startedAt = Date.now();
    let sessionId: string | undefined;
    if (sessionContext && typeof sessionContext === "object" && "id" in sessionContext) {
      sessionId = sessionContext.id;
    }

    const result = await this.generateResponseInner(userMessage, sessionContext, conversationHistory, language);

    const strategy = getIntentResponseStrategy(result.intent || "");
    const provider = result.provider || "none";
    logAnalytics({
      ts: new Date().toISOString(),
      intent: result.intent || "unknown",
      responseStrategy: strategy,
      provider,
      latencyMs: Date.now() - startedAt,
      success: provider !== "none",
      // Fallback: AI rejimda (llm/hybrid strategiya) lekin javob template bilan qaytdi
      fallback: provider === "template" && strategy !== "template",
      cached: provider === "cache",
      tool: result.toolUsed || "none",
      language,
      sessionId,
    });
    return result;
  }

  async generateResponseInner(
    userMessage: string,
    sessionContext: any,
    conversationHistory: ChatMessage[],
    language: "uz" | "ru" | "en" = "uz"
  ): Promise<{ content: string; intent?: string; toolUsed?: string; provider?: string; auth_required?: boolean }> {
    // ✅ DEBUG LOGLAR - HAR BIR SO'ROVDA ISHLAYDI
    console.log("=".repeat(60));
    console.log("📝 [SESSION CONTEXT]:", JSON.stringify(sessionContext, null, 2));
    console.log("-".repeat(60));
    console.log("💬 [CONVERSATION HISTORY]:", JSON.stringify(conversationHistory, null, 2));
    console.log("-".repeat(60));
    console.log(`💬 [USER MESSAGE]: ${userMessage}`);
    console.log(`🌐 [LANGUAGE]: ${language}`);
    console.log("=".repeat(60));

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

      console.log(`[DEBUG] Initial intent: ${intent.intent}, entities:`, intent.entities);

      // Step 1.5: Follow-up detection (BOSQICH 3 — Context Manager)
      // follow-up-context.ts moduli: region/category/direction/degree/language/byudjet
      // kontekstini to'playdi va qisqa follow-up so'rovlarga qo'shadi.
      // "Toshkentdagi universitetlar → ITlari → Davlatlari" zanjiri shu yerda ishlaydi.
      const followUp = augmentFollowUp(userMessage, sessionContext, conversationHistory, language);
      if (followUp.augmented) {
        effectiveMessage = followUp.effectiveMessage;
        intent = followUp.intent;
      }

      // Continuous Profile Update: foydalanuvchining har bir ma'lumoti session profiliga yozib boriladi
      if (sessionContext) {
        sessionContext.recommendationProfile = updateRecommendationProfile(
          sessionContext.recommendationProfile || {},
          userMessage,
          intent.entities
        );
      }

      console.log(`[DEBUG] Final intent: ${intent.intent}, secondaryIntents:`, intent.secondaryIntents, `, effectiveMessage: ${effectiveMessage}`);

      // Step 1.55: FIELD CLARIFICATION (BOSQICH 12 — user qoidasi 8)
      // "Kontrakti qancha?" kabi BARE field so'rovi + lastUniversity YO'Q bo'lsa
      // → tool ishlamaydi (taxmin qilmaydi), agent qaysi universitеt nazarda
      // tutilganini so'raydi. Aks holda barcha universitеtlarning umumiy
      // narxi chiqib ketardi ("PDP chi? → uning narxlari qancha?" zanjiri esa
      // lastUniversity orqali allaqachon ishlaydi — bu yerda faqat CONTEXT'SIZ
      // bare so'rov tutib olinadi).
      const fieldRequest = detectRequestField(effectiveMessage);
      const hasUniversityContext =
        !!intent.entities?.university ||
        !!sessionContext?.lastUniversity ||
        (sessionContext?.lastRecommendations?.length ?? 0) > 0;
      if (
        fieldRequest &&
        fieldRequest !== "summary" &&
        isBareFieldRequest(effectiveMessage) &&
        !hasUniversityContext
      ) {
        const content = universityClarificationResponse(requestFieldLabel(fieldRequest), language);
        console.log(`[FieldClarification] "${userMessage}" — ${fieldRequest} so'raldi, lekin universitеt konteksti yo'q → so'raldi`);
        return {
          content,
          intent: intent.intent,
          toolUsed: "none",
          provider: "template",
        };
      }

      // Step 1.6: CACHE LAYER (BOSQICH 7)
      // Template strategiya (deterministik) javoblarni memory cache dan tekshiramiz.
      // Faqat dataIntent bo'lgan intent'lar cache qilinadi (greeting/thanks emas).
      // Cache HIT bo'lsa — tool chaqirilmaydi (API yuki tejaladi).
      const cacheStrategy = getIntentResponseStrategy(intent.intent);
      const cacheKey = responseCache.buildKey(intent.intent, effectiveMessage, language);
      const cachedEntry = responseCache.get(cacheKey);
      // GUEST REJIM: guest'lar uchun cache o'qilmaydi — login qilgan userning
      // data javobi guest'ga qaytib ketishi mumkin (ma'lumot sizib chiqishi)!
      if (cachedEntry && cacheStrategy === "template" && getIntentDataFlag(intent.intent) && sessionContext?.isGuest !== true) {
        console.log(`[Cache] HIT: ${cacheKey} (provider=${cachedEntry.provider})`);
        return {
          content: cachedEntry.content,
          intent: cachedEntry.intent,
          toolUsed: cachedEntry.toolUsed,
          provider: "cache",
        };
      }

      // Step 1.7: BOSQICH 5 — LLM-assisted entity refinement
      // Provider mavjud bo'lsa va entity'lar muhim intent bo'lsa (data intent /
      // qabul/transfer), message'dan entity'lar LLM orqali aniqroq aniqlanadi va
      // rule-based natija bilan birlashtiriladi. Xato/timeout bo'lsa rule-based
      // natija saqlanadi (fallback) — agent hech qachon buzilmaydi.
      //
      // RESPONSE STRATEGY (BOSQICH 6) OPTIMIZATSIYASI: javob TEMPLATE orqali
      // qaytadigan intent'lar (responseStrategy="template") uchun LLM entity
      // extraction ham chaqirilmaydi — javob template bo'ladi, rule-based
      // entity'lar yetarli. Shunda token 90-95% tejaladi (entity extraction +
      // response chaqiruvi ikkalasi ham ketmaydi). Faqat "llm" / "hybrid"
      // strategy (recommendation, comparison) va admission/transfer uchun
      // LLM extraction ishlaydi.
      let responseStrategy = getIntentResponseStrategy(intent.intent);
      // RESPONSE STRATEGY OVERRIDE (Fix): direction_search + kasb/istek so'zi → hybrid.
      // "Men AI bo'yicha ishlamoqchiman" — oddiy yo'nalish katalogi EMAS, shaxsiy
      // maslahat. Template "mana IT yo'nalishlari" deyishi o'rniga LLM nega aynan
      // shu yo'nalish mosligini tushuntiradi. "IT yo'nalishlari" (oddiy katalog)
      // esa template qoladi — kasb/istek so'zi yo'q.
      //
      // MUHIM: faqat direction_search intent uchun va message da kasb/istek/maqsad
      // so'zlari bo'lsa. Negativ: "yo'nalish(lar)i", "ro'yxati", "mavjud" kabi
      // katalog so'zlari bo'lsa — template qoladi.
      if (intent.intent === "direction_search" &&
          /\b(bo'lmoqchiman|ishlamoqchiman|qiziqaman|qiziqtiradi|yoqadi|yaxshi ko'raman|o'qimoqchiman|o'rganmoqchiman|kirmoqchiman|maqsadim|orzuim)\b/i.test(effectiveMessage) &&
          !/\b(yo'nalish(?:lar|lari|larini|lariga|laridan|larining)?|ro'yxati|mavjud|katalogi)\b/i.test(effectiveMessage)) {
        responseStrategy = "hybrid";
        console.log(`[StrategyOverride] direction_search → hybrid (kasb/istek so'zi): "${effectiveMessage.substring(0, 60)}"`);
      }
      const needsLlm = responseStrategy === "llm" || responseStrategy === "hybrid";
      // TODO (future): "hybrid" hozircha "llm" yo'nalishiga boradi (API data +
      // LLM tahlil) — keyingi bosqichda template struktura + LLM matn aralashmasi
      // qo'shiladi. Hozircha farq yo'q, lekin log aniq ko'rsatsin:
      console.log(`[DEBUG] Response strategy: ${responseStrategy} (intent=${intent.intent})`);
      // GUEST REJIM: guest'lar uchun LLM entity extraction CHAQIRILMAYDI —
      // token tejaladi (guest javobi baribir bloklanadi yoki template bo'ladi).
      // Faqat login qilgan user'lar uchun ishlaydi.
      if (this.initialized && needsLlm && sessionContext?.isGuest !== true) {
        // Katalog intent'lari (*_list) o'z-o'zidan to'liq — entity'lar qo'shimcha
        // qiymat bermaydi, LLM chaqiruvi tejaladi.
        const isEntityRelevant =
          (getIntentDataFlag(intent.intent) && !intent.intent.endsWith("_list")) ||
          intent.intent === "admission" || intent.intent === "transfer";
        if (isEntityRelevant) {
          const ruleBased = { ...intent.entities };
          const llmEntities = await this.extractEntitiesWithLLM(effectiveMessage, language);
          if (llmEntities) {
            // MUHIM (reviewer): konfliktda RULE-BASED yutadi — LLM hallucination
            // (message'da yo'q region/degree uydirib qo'shish) xavfini oldini oladi.
            // LLM faqat rule-based TOPA OLMAGAN bo'shliqlarni to'ldiradi.
            // Real benchmark'dan keyin istalgan kalit uchun LLM ustunligini
            // yoqish mumkin (masalan direction — rule-based false positive'lari bor).
            //
            // MUHIM (Fix): LLM degree'ni faqat message'da ANIQ akademik daraja
            // so'zi bo'lsa qabul qilamiz. "doktor bo'lmoqchiman" da LLM "phd"
            // deb xato talqin qilishi mumkin (doktor = shifokor kasbi, doktorantura
            // emas!). Xuddi shunday language/educationType ham faqat aniq so'z
            // bo'lsa qabul qilinadi — LLM taxmin qilmasin.
            const explicitDegreeWord = /\b(bakalavr|bakalavriat|bachelor|magistr|magistratura|master|doktorantura|doktoranturada|phd|doctor of science)\b/i.test(effectiveMessage);
            const explicitLangWord = /\b(ingliz|rus|o'zbek|english|russian|uzbek)\b/i.test(effectiveMessage);
            const explicitETWord = /\b(kunduzgi|sirtqi|kechki|masofaviy|full-?time|part-?time|distance)\b/i.test(effectiveMessage);
            const filteredLlm = { ...llmEntities };
            if (filteredLlm.degree !== undefined && !ruleBased.degree && !explicitDegreeWord) {
              delete filteredLlm.degree;
            }
            if (filteredLlm.language !== undefined && !ruleBased.language && !explicitLangWord) {
              delete filteredLlm.language;
            }
            if (filteredLlm.educationType !== undefined && !ruleBased.educationType && !explicitETWord) {
              delete filteredLlm.educationType;
            }
            intent.entities = { ...filteredLlm, ...ruleBased };
            console.log(`[LLM Entities] rule=${JSON.stringify(ruleBased)} llm=${JSON.stringify(llmEntities)} merged=${JSON.stringify(intent.entities)}`);
          }
        }
      }

      // Step 2: Execute tools
      let toolResults: any[] = [];
      try {
        toolResults = await toolRouter.execute(intent, sessionContext, effectiveMessage);
        console.log(`[DEBUG] Tool results: ${toolResults.length} results`);
        if (toolResults.length > 0) {
          console.log(`[DEBUG] First tool result:`, JSON.stringify(toolResults[0], null, 2));
        }
      } catch (error) {
        console.error("[Tool Error]", error);
      }

      // ===== TOOL ACCESS POLICY / AUTH_REQUIRED (BOSQICH 1 + GUEST) =====
      // Guest data tool'iga chiqmoqchi bo'lsa (tool-router authRequired qaytardi)
      // YOKI user tokeni eskirib refresh ham ishlamagan bo'lsa (AUTH_EXPIRED) —
      // API natijasi yo'q, LOGIN so'raladi. "ma'lumot topilmadi" deb yolg'on
      // javob berilmaydi (401 ≠ ma'lumot yo'q).
      const authRequired = toolResults.some((r: any) =>
        r.authRequired === true ||
        (typeof r.error === "string" && /AUTH_EXPIRED/i.test(r.error))
      );
      if (authRequired) {
        const content = this.getAuthRequiredResponse(language);
        console.log(`[AuthRequired] intent=${intent.intent} — login so'raladi (guest yoki token eskirgan)`);
        return {
          content,
          intent: intent.intent,
          // Frontend ChatMessage buni ushlab, LOGIN CTA kartasini ko'rsatadi
          // (oddiy matn o'rniga [ Kirish ] tugmasi bilan)
          toolUsed: "auth_required",
          auth_required: true,
          provider: "template",
        };
      }

      // Step 3: DATA intents
      // BOSQICH 4 (JSON-driven config): dataIntent flag'i intent-config.json dan
      // o'qiladi — yangi intent qo'shishda provider-manager kodiga tegish shart emas.
      // dataIntent=true bo'lgan intent'lar: data bo'lmasa template fallback ishlatadi
      // (AI hallucination oldini oladi).
      const isDataIntent = getIntentDataFlag(intent.intent);
      const hasRealData = toolResults.some((r: any) => {
        if (!r.success || !r.data) return false;
        if (Array.isArray(r.data)) return r.data.length > 0;
        if (typeof r.data === "object") {
          const d = r.data as any;
          const arrays = Object.values(d).filter((v: any) => Array.isArray(v));
          if (arrays.some((a: any) => a.length > 0)) return true;
          if (d.needsClarification) return true;
          if (d.id) return true;
          if (d.universityOverview || d.regionOverview) return true;
          // search_tuition natijasi: { hasData: true, universities: [...] }
          if (d.hasData === true && Array.isArray(d.universities) && d.universities.length > 0) return true;
          // list_directions natijasi: { categories: [...] }
          if (Array.isArray(d.categories) && d.categories.length > 0) return true;
          return false;
        }
        return false;
      });

      console.log(`[DEBUG] isDataIntent: ${isDataIntent}, hasRealData: ${hasRealData}`);

      // MUHIM (Fix): recommend tool needsClarification qaytarsa ("tanlasam",
      // "bilmayman" kabi maslahat so'rovlarida ma'lumot yetishmaydi) — uni LLM'ga
      // yuborish NOTO'G'RI: LLM o'zi "topilmadi" deb yozib yuboradi. To'g'risi:
      // template clarification SAVOLLARINI ko'rsatadi ("Qaysi shahar? Qanday
      // yo'nalish? Davlatmi yoki xususiy?") — keyingi javobga asos bo'ladi.
      const needsClarification = toolResults.some((r: any) => r.data?.needsClarification === true);
      if (needsClarification) {
        const content = this.getTemplateResponse(intent.intent, toolResults, userMessage, language, intent.entities, intent.entityConfidence);
        console.log(`[DEBUG] needsClarification=true — template clarification savollari ishlatiladi`);
        return {
          content,
          intent: intent.intent,
          toolUsed: toolResults.length > 0 ? toolResults.map((r: any) => r.tool).filter(Boolean).join(", ") : "none",
          provider: "template",
        };
      }

      if (isDataIntent && !hasRealData) {
        const content = this.getTemplateResponse(intent.intent, toolResults, userMessage, language, intent.entities, intent.entityConfidence);
        console.log(`[DEBUG] Using template response (no data found)`);
        // CACHE: "topilmadi" javoblari ham cache qilinadi — takroriy bo'sh so'rovlar API'ga bormaydi
        if (cacheStrategy === "template") {
          responseCache.set(cacheKey, {
            content,
            provider: "template",
            toolUsed: toolResults.length > 0 ? toolResults.map((r: any) => r.tool).filter(Boolean).join(", ") : "none",
            intent: intent.intent,
          });
          console.log(`[Cache] SET (no data): ${cacheKey}`);
        }
        return {
          content,
          intent: intent.intent,
          toolUsed: toolResults.length > 0 ? toolResults.map((r: any) => r.tool).filter(Boolean).join(", ") : "none",
          provider: "template",
        };
      }

      if (intent.intent === "greeting") {
        const content = this.getTemplateResponse(intent.intent, toolResults, userMessage, language);
        console.log(`[DEBUG] Using template response (greeting)`);
        return {
          content,
          intent: intent.intent,
          toolUsed: "none",
          provider: "template",
        };
      }

      // ============================================================
      // RESPONSE STRATEGY (BOSQICH 6): data intent + data bor → TEMPLATE (0 token)
      // ============================================================
      // Sizning arxitektura taklifingiz: AI faqat reasoning talab qiladigan
      // intent'larda ishlatiladi (responseStrategy="llm": recommendation,
      // comparison). Oddiy ma'lumot qidiruv (university_search, direction_search,
      // tuition_search, grant_search, news_search, *_list, university_detail)
      // template orqali javob beradi — LLM chaqirilmaydi.
      //
      // Natija: token 90-95% tejaladi, javoblar tezroq, API limitlari kam tugaydi.
      // (responseStrategy Step 1.7 da e'lon qilingan — bu yerda qayta e'lon qilinmaydi)
      if (isDataIntent && hasRealData && responseStrategy === "template") {
        const content = this.getTemplateResponse(intent.intent, toolResults, userMessage, language, intent.entities, intent.entityConfidence);
        console.log(`[DEBUG] Using template response (data intent, strategy=template) — LLM chaqirilmadi`);
        // CACHE LAYER: template javobni cache ga yozamiz — keyingi bir xil so'rov API'ga bormaydi
        responseCache.set(cacheKey, {
          content,
          provider: "template",
          toolUsed: toolResults.length > 0 ? toolResults.map((r: any) => r.tool).filter(Boolean).join(", ") : "none",
          intent: intent.intent,
        });
        console.log(`[Cache] SET: ${cacheKey}`);
        return {
          content,
          intent: intent.intent,
          toolUsed: toolResults.length > 0 ? toolResults.map((r: any) => r.tool).filter(Boolean).join(", ") : "none",
          provider: "template",
        };
      }

      // ============================================================
      // HYBRID ENGINE (BOSQICH 7): API data + LLM tahlil
      // ============================================================
      // responseStrategy="hybrid" bo'lgan intent'lar (recommendation, comparison):
      // API ma'lumotlari (kompakt — faqat kerakli maydonlar) LLM'ga beriladi,
      // LLM "nega aynan shular" tahlilini yozadi. LLM muvaffaqiyatsiz bo'lsa →
      // template fallback (agent buzilmaydi).
      if (isDataIntent && hasRealData && responseStrategy === "hybrid" && this.initialized) {
        const hybridResult = await this.tryHybridResponse(intent, toolResults, conversationHistory, userMessage, language);
        if (hybridResult !== null) {
          console.log(`[DEBUG] HYBRID response (compact data + LLM analysis) via ${hybridResult.provider}`);
          return {
            content: hybridResult.content,
            intent: intent.intent,
            toolUsed: toolResults.length > 0 ? toolResults.map((r: any) => r.tool).filter(Boolean).join(", ") : "none",
            provider: hybridResult.provider,
          };
        }
        // LLM muvaffaqiyatsiz → template fallback
        const content = this.getTemplateResponse(intent.intent, toolResults, userMessage, language, intent.entities, intent.entityConfidence);
        console.log(`[DEBUG] HYBRID LLM failed — using template fallback`);
        return {
          content,
          intent: intent.intent,
          toolUsed: toolResults.length > 0 ? toolResults.map((r: any) => r.tool).filter(Boolean).join(", ") : "none",
          provider: "template",
        };
      }

      if (!this.initialized) {
        const content = this.getTemplateResponse(intent.intent, toolResults, userMessage, language, intent.entities, intent.entityConfidence);
        console.log(`[DEBUG] Using template response (no provider)`);
        return {
          content,
          intent: intent.intent,
          toolUsed: toolResults.length > 0 ? toolResults.map((r: any) => r.tool).filter(Boolean).join(", ") : "none",
          provider: "template",
        };
      }

      // Build context for AI
      const systemPrompt = contextBuilder.buildSystemPrompt(language);
      const context = contextBuilder.buildContext(toolResults, sessionContext, language);

      console.log(`[DEBUG] System prompt length: ${systemPrompt.length}, Context length: ${context.length}`);

      // Try providers in order
      const errors: string[] = [];

      // Try Groq first (fastest, free) — limit xatosi bo'lsa circuit breaker ishlaydi
      if (this.groqClient && !this.shouldSkipProvider("groq")) {
        try {
          console.log(`[DEBUG] Trying Groq...`);
          const result = await this.callGroq(systemPrompt, context, conversationHistory, userMessage);
          console.log(`[DEBUG] Groq response successful`);
          return {
            ...result,
            intent: intent.intent,
            toolUsed: toolResults.length > 0 ? toolResults.map((r: any) => r.tool).filter(Boolean).join(", ") : "none",
            provider: "groq",
          };
        } catch (error: any) {
          errors.push(`Groq: ${error.message}`);
          console.error("[Groq Error]", error);
          if (this.isLimitError(error)) this.openCircuit("groq");
        }
      }

      // Try OpenRouter next (zaxira — Groq limiti tugaganda ishlaydi)
      if (this.openRouterClient && !this.shouldSkipProvider("openrouter")) {
        try {
          console.log(`[DEBUG] Trying OpenRouter...`);
          const result = await this.callOpenRouter(systemPrompt, context, conversationHistory, userMessage);
          console.log(`[DEBUG] OpenRouter response successful`);
          return {
            ...result,
            intent: intent.intent,
            toolUsed: toolResults.length > 0 ? toolResults.map((r: any) => r.tool).filter(Boolean).join(", ") : "none",
            provider: "openrouter",
          };
        } catch (error: any) {
          errors.push(`OpenRouter: ${error.message}`);
          console.error("[OpenRouter Error]", error);
          if (this.isLimitError(error)) this.openCircuit("openrouter");
        }
      }

      // Try DeepSeek next (zaxira — OpenRouter ham tugasa)
      if (this.deepseekClient && !this.shouldSkipProvider("deepseek")) {
        try {
          console.log(`[DEBUG] Trying DeepSeek...`);
          const result = await this.callDeepSeek(systemPrompt, context, conversationHistory, userMessage);
          console.log(`[DEBUG] DeepSeek response successful`);
          return {
            ...result,
            intent: intent.intent,
            toolUsed: toolResults.length > 0 ? toolResults.map((r: any) => r.tool).filter(Boolean).join(", ") : "none",
            provider: "deepseek",
          };
        } catch (error: any) {
          errors.push(`DeepSeek: ${error.message}`);
          console.error("[DeepSeek Error]", error);
          if (this.isLimitError(error)) this.openCircuit("deepseek");
        }
      }

      // Try Gemini next (free, backup)
      if (this.geminiModel) {
        try {
          console.log(`[DEBUG] Trying Gemini...`);
          const result = await this.callGemini(systemPrompt, context, conversationHistory, userMessage);
          console.log(`[DEBUG] Gemini response successful`);
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
          console.log(`[DEBUG] Trying OpenAI...`);
          const result = await this.callOpenAI(systemPrompt, context, conversationHistory, userMessage);
          console.log(`[DEBUG] OpenAI response successful`);
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
      const content = this.getTemplateResponse(intent.intent, toolResults, userMessage, language, intent.entities, intent.entityConfidence);
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

  /**
   * HYBRID ENGINE (BOSQICH 7): API data + LLM tahlil.
   *
   * Tool natijalaridan KOMPAKT context (faqat kerakli maydonlar — buildCompactContext)
   * quriladi va LLM'ga yuboriladi. LLM "nega aynan shular" tahlilini yozadi.
   * Muvaffaqiyatsiz (xato/timeout/bo'sh) → null qaytaradi (template fallback).
   *
   * PROMPT OPTIMIZATSIYA: butun API JSON'ini emas, faqat nom/joy/narx/grant
   * kabi tavsiya qaroriga ta'sir qiladigan maydonlar yuboriladi (token 3-5x kam).
   */
  /**
   * HYBRID ENGINE — muvaffaqiyatli provider nomini ham qaytaradi
   * (analytics to'g'ri ko'rsatsin: Groq emas, balki haqiqiy javob bergan provider).
   */
  private async tryHybridResponse(
    intent: IntentResult,
    toolResults: any[],
    conversationHistory: ChatMessage[],
    userMessage: string,
    language: "uz" | "ru" | "en"
  ): Promise<{ content: string; provider: string } | null> {
    const compactContext = buildCompactContext(toolResults as any);
    if (!compactContext.trim()) {
      console.log("[Hybrid] Kompakt context bo'sh — template ishlatiladi");
      return null;
    }

    const systemPrompt = contextBuilder.buildSystemPrompt(language);
    const errors: string[] = [];

    // Groq birinchi — limit xatosi bo'lsa circuit breaker ishlaydi
    if (this.groqClient && !this.shouldSkipProvider("groq")) {
      try {
        console.log(`[Hybrid] Trying Groq (compact context: ${compactContext.length} chars)`);
        const result = await this.callGroq(systemPrompt, compactContext, conversationHistory, userMessage);
        if (result.content && result.content.trim().length > 20) {
          console.log(`[Hybrid] Groq response successful`);
          return { content: result.content, provider: "groq" };
        }
      } catch (error: any) {
        errors.push(`Groq: ${error.message}`);
        console.error("[Hybrid Groq Error]", error);
        if (this.isLimitError(error)) this.openCircuit("groq");
      }
    }

    // OpenRouter backup (Groq limiti tugaganda)
    if (this.openRouterClient && !this.shouldSkipProvider("openrouter")) {
      try {
        console.log(`[Hybrid] Trying OpenRouter`);
        const result = await this.callOpenRouter(systemPrompt, compactContext, conversationHistory, userMessage);
        if (result.content && result.content.trim().length > 20) {
          console.log(`[Hybrid] OpenRouter response successful`);
          return { content: result.content, provider: "openrouter" };
        }
      } catch (error: any) {
        errors.push(`OpenRouter: ${error.message}`);
        console.error("[Hybrid OpenRouter Error]", error);
        if (this.isLimitError(error)) this.openCircuit("openrouter");
      }
    }

    // DeepSeek backup (OpenRouter ham tugasa)
    if (this.deepseekClient && !this.shouldSkipProvider("deepseek")) {
      try {
        console.log(`[Hybrid] Trying DeepSeek`);
        const result = await this.callDeepSeek(systemPrompt, compactContext, conversationHistory, userMessage);
        if (result.content && result.content.trim().length > 20) {
          console.log(`[Hybrid] DeepSeek response successful`);
          return { content: result.content, provider: "deepseek" };
        }
      } catch (error: any) {
        errors.push(`DeepSeek: ${error.message}`);
        console.error("[Hybrid DeepSeek Error]", error);
        if (this.isLimitError(error)) this.openCircuit("deepseek");
      }
    }

    // Gemini backup
    if (this.geminiModel) {
      try {
        console.log(`[Hybrid] Trying Gemini`);
        const result = await this.callGemini(systemPrompt, compactContext, conversationHistory, userMessage);
        if (result.content && result.content.trim().length > 20) {
          console.log(`[Hybrid] Gemini response successful`);
          return { content: result.content, provider: "gemini" };
        }
      } catch (error: any) {
        errors.push(`Gemini: ${error.message}`);
        console.error("[Hybrid Gemini Error]", error);
      }
    }

    // OpenAI oxirgi
    if (this.openaiClient) {
      try {
        console.log(`[Hybrid] Trying OpenAI`);
        const result = await this.callOpenAI(systemPrompt, compactContext, conversationHistory, userMessage);
        if (result.content && result.content.trim().length > 20) {
          console.log(`[Hybrid] OpenAI response successful`);
          return { content: result.content, provider: "openai" };
        }
      } catch (error: any) {
        errors.push(`OpenAI: ${error.message}`);
        console.error("[Hybrid OpenAI Error]", error);
      }
    }

    console.error(`[Hybrid] All providers failed: ${errors.join("; ")}`);
    return null;
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

    // BOSQICH 14 (Conversation Snapshot): uzoq suhbatlarda eski xabarlar
    // qisqartiriladi (1-qator, 100 belgi) — token tejaydi, kontekst saqlanadi.
    // REVIEWER FIX: qisqa suhbatlarda (<=12 xabar) snapshot hech narsani
    // o'zgartirmaydi — slice(-8) 8 ta TO'LIQ xabar beradi (avvalgidek).
    // Faqat 12+ xabarlik uzoq suhbatlarda eski xabarlar qisqartiriladi.
    const historyForLlm = buildSnapshotHistory(conversationHistory).slice(-8);
    for (const msg of historyForLlm) {
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

  private async callOpenRouter(
    systemPrompt: string,
    context: string,
    conversationHistory: ChatMessage[],
    userMessage: string
  ): Promise<{ content: string }> {
    if (!this.openRouterClient) throw new Error("OpenRouter not initialized");

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (context) {
      messages.push({ role: "system", content: `Context:\n${context}` });
    }

    // BOSQICH 14 (Conversation Snapshot): uzoq suhbatlarda eski xabarlar
    // qisqartiriladi (1-qator, 100 belgi) — token tejaydi, kontekst saqlanadi.
    // REVIEWER FIX: qisqa suhbatlarda (<=12 xabar) snapshot hech narsani
    // o'zgartirmaydi — slice(-8) 8 ta TO'LIQ xabar beradi (avvalgidek).
    // Faqat 12+ xabarlik uzoq suhbatlarda eski xabarlar qisqartiriladi.
    const historyForLlm = buildSnapshotHistory(conversationHistory).slice(-8);
    for (const msg of historyForLlm) {
      if (msg.role !== "system") {
        messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
      }
    }

    messages.push({ role: "user", content: userMessage });

    const completion = await this.openRouterClient.chat.completions.create({
      model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
      messages: messages as any,
      temperature: 0.3,
      max_tokens: 1024,
    });

    return {
      content: completion.choices[0]?.message?.content || "Kechirasiz, javob yaratishda xatolik yuz berdi.",
    };
  }

  private async callDeepSeek(
    systemPrompt: string,
    context: string,
    conversationHistory: ChatMessage[],
    userMessage: string
  ): Promise<{ content: string }> {
    if (!this.deepseekClient) throw new Error("DeepSeek not initialized");

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (context) {
      messages.push({ role: "system", content: `Context:\n${context}` });
    }

    // BOSQICH 14 (Conversation Snapshot): uzoq suhbatlarda eski xabarlar
    // qisqartiriladi (1-qator, 100 belgi) — token tejaydi, kontekst saqlanadi.
    // REVIEWER FIX: qisqa suhbatlarda (<=12 xabar) snapshot hech narsani
    // o'zgartirmaydi — slice(-8) 8 ta TO'LIQ xabar beradi (avvalgidek).
    // Faqat 12+ xabarlik uzoq suhbatlarda eski xabarlar qisqartiriladi.
    const historyForLlm = buildSnapshotHistory(conversationHistory).slice(-8);
    for (const msg of historyForLlm) {
      if (msg.role !== "system") {
        messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
      }
    }

    messages.push({ role: "user", content: userMessage });

    const completion = await this.deepseekClient.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
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

    // BOSQICH 14 (Conversation Snapshot): uzoq suhbatlarda eski xabarlar
    // qisqartiriladi (1-qator, 100 belgi) — token tejaydi, kontekst saqlanadi.
    // REVIEWER FIX: qisqa suhbatlarda (<=12 xabar) snapshot hech narsani
    // o'zgartirmaydi — slice(-8) 8 ta TO'LIQ xabar beradi (avvalgidek).
    // Faqat 12+ xabarlik uzoq suhbatlarda eski xabarlar qisqartiriladi.
    const historyForLlm = buildSnapshotHistory(conversationHistory).slice(-8);
    for (const msg of historyForLlm) {
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

  /**
   * TEMPLATE RESPONSE (FORMATTER LAYER - BOSQICH 7)
   *
   * Template javoblarni responseBuilder (formatter/ modullari) orqali qurish.
   * Eski 700+ satrli shablon logikasi formatter/ modullariga ko'chirildi:
   * university.ts, direction.ts, tuition.ts, grant.ts, news.ts,
   * comparison.ts, recommendation.ts, common.ts
   *
   * CONFIDENCE SCORE: entityConfidence past bo'lsa aniqlashtiruvchi savol
   * javob oxiriga qo'shiladi.
   */
  private getTemplateResponse(
    intent: string,
    toolResults: any[],
    message: string,
    language: string,
    entities?: Record<string, any>,
    entityConfidence?: Record<string, number>
  ): string {
    return responseBuilder.build({
      intent,
      toolResults,
      message,
      language,
      entities,
      entityConfidence,
    });
  }

  /**
   * AUTH REQUIRED RESPONSE (BOSQICH 1 + GUEST):
   * Guest data tool'ini so'raganda yoki user tokeni eskirganda (AUTH_EXPIRED)
   * qaytariladi. "ma'lumot topilmadi" o'rniga — login so'rovi. Kirish tugmasi
   * mentalaba.uz auth sahifasiga olib boradi (frontend token'ni oladi).
   */
  private getAuthRequiredResponse(language: string): string {
    if (language === "ru") {
      return `🔐 **Для просмотра этой информации необходимо войти в аккаунт Mentalaba.**

Университеты, направления, гранты и стоимость контрактов доступны авторизованным пользователям.

[🔑 Войти в аккаунт Mentalaba](https://mentalaba.uz/auth?sign-in) · [Регистрация](https://mentalaba.uz/auth?sign-up)

В чате, консультациях и общих вопросах я с радостью помогу без входа! 😊`;
    }
    if (language === "en") {
      return `🔐 **You need to sign in to your Mentalaba account to view this information.**

Universities, directions, grants and tuition fees are available to signed-in users.

[🔑 Sign in to Mentalaba](https://mentalaba.uz/auth?sign-in) · [Create an account](https://mentalaba.uz/auth?sign-up)

I'm happy to help with chat, advice and general questions without sign-in! 😊`;
    }
    return `🔐 **Bu ma'lumotni ko'rish uchun Mentalaba accountingizga kirishingiz kerak.**

Universitetlar, yo'nalishlar, grantlar va kontrakt narxlari bo'yicha haqiqiy ma'lumotlar login qilgan foydalanuvchilar uchun ochiq.

[🔑 Mentalaba accountiga kirish](https://mentalaba.uz/auth?sign-in) · [Ro'yxatdan o'tish](https://mentalaba.uz/auth?sign-up)

Suhbat, maslahat va umumiy savollarda men sizga xohlagancha yordam beraman! 😊`;
  }

}



// ✅ Eksport qilish
export const providerManager = new ProviderManager();