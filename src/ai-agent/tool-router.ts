import '@/lib/external-api-patch';
import type { ToolResult, IntentResult } from "@/types";
import { lookupManager } from "@/data/lookups";
import { externalApi } from "@/lib/external-api";
import { embeddingService } from "./embedding-service";

export class ToolRouter {
  // Location -> region ID mapping (15 ta viloyat)
  private readonly REGION_MAP: Record<string, number> = {
    'toshkent shahri': 14, 'toshkent sh.': 14,
    'toshkent': 11, 'toshkent viloyati': 11,
    'qoraqalpoq': 1, 'qoraqalpogiston': 1, 'nukus': 1,
    'andijon': 2,
    'buxoro': 3,
    'jizzax': 4,
    'qashqadaryo': 5, 'qarshi': 5,
    'navoiy': 6,
    'namangan': 7,
    'samarqand': 8,
    'surxondaryo': 9, 'termiz': 9,
    'sirdaryo': 10, 'guliston': 10,
    "farg'ona": 12, 'fergana': 12, "fargona": 12, 'qoqon': 12,
    'xorazm': 13, 'urganch': 13,
  };

  // Universitet overview ma'lumotini cache qilish
  private overviewCache: {
    data: {
      totalCount: number;
      categories: { state: number; private: number; international: number };
      universityExamples: Array<{ name: string; slug: string; type: string }>;
      byRegion: Record<number, { total: number; state: number; private: number; international: number }>;
      fetchedAt: number;
    } | null;
  } = { data: null };
  private readonly OVERVIEW_CACHE_TTL = 30 * 60 * 1000; // 30 daqiqa

  // Kategoriya kalit sozlar — "tibbiyot" desa, barcha tibbiyotga oid yo'nalishlarni topish
  // MUHIM: Agar user "IT" desa, faqatgina "Kompyuter fanlari" emas, balki
  // "Sun'iy intellekt", "Kiberxavfsizlik", "Dasturiy injiniring" kabi hammasi chiqishi kerak
  private readonly CATEGORY_KEYWORDS: Record<string, string[]> = {
    'it': ["suniy intellekt", "axborot texnolog", "dasturlash", "kiberxavfsizlik",
           "malumotlar", "data science", "kompyuter fan", "raqamli", "software", 
           "dasturiy injiniring", "injiniring", "it ", "information", "computer",
           "web", "mobile", "cloud", "ai", "machine learning", "full stack",
           "fintech", "blokcheyn", "siber", "telekommunikatsiya"],
    'tibbiyot': ["tibbiyot", "stomatolog", "farmatsevtika", "davolash", "pediatriya",
                 "jarrohlik", "terapiya", "medical", "dentistry", "klinik",
                 "biologiya", "genetika", "anatomiya", "fiziologiya", "farmatsiya",
                 "xamshiralik", "sogliqni saqlash", "kardiologiya", "neyrologiya",
                 "akusherlik", "ginekologiya", "travmatologiya", "oftalmologiya",
                 "lor", "onkologiya", "dermatologiya", "venerologiya", "radiologiya",
                 "reabilitatsiya", "sanitariya", "epidemiologiya", "immunologiya"],
    'iqtisod': ["iqtisod", "moliya", "buxgalteriya", "bank ishi", "menejment",
                "marketing", "logistika", "finance", "economics", "audit",
                "soliq", "kredit", "investitsiya", "tijorat", "savdo",
                "business", "startap", "tadbirkor", "konsalting", "reklama"],
    'huquq': ["huquq", "yurisprudensiya", "advokat", "sud ishi", "law", "legal",
              "prokuratura", "notarius", "huquqshunos", "jinoyat", "fuqaro",
              "konstitutsiya", "xalqaro huquq", "soliq huquqi"],
    'pedagogika': ["pedagogika", "talim", "okituvchi", "maktabgacha", "psixologiya",
                   "maxsus pedagogika", "defektologiya", "logopediya", "metodika",
                   "boshlangich talim", "jismoniy talim", "kasb talimi"],
    'muhandislik': ["muhandislik", "qurilish", "arxitektura", "energetika", "engineering",
                    "elektr", "mexanika", "texnologiya", "ishlab chiqarish",
                    "avtomatlashtirish", "robototexnika", "materialshunoslik",
                    "neft", "gaz", "konchilik", "metallurgiya", "geologiya"],
    'filologiya': ["filologiya", "tilshunoslik", "lingvistika", "tarjima", "chet tili",
                   "ingliz tili", "rus tili", "nemis tili", "fransuz tili", "xitoy tili",
                   "arab tili", "koreys tili", "yapon tili", "turk tili", "adabiyot",
                   "jurnalistika", "nashriyot", "muharrir", "matn"],
    'sanat': ["sanat", "dizayn", "moda", "rassomlik", "musiqa", "madaniyat", "kino",
              "teatr", "xoreografiya", "raqs", "tasviriy sanat", "amaliy sanat",
              "grafika", "haykaltaroshlik", "foto", "video", "animatsiya"],
    'sport': ["sport", "jismoniy", "fizkultura", "soglikni saqlash", "trener",
              "sport menedjment", "sog'lomlashtirish", "olimpiya", "futbol",
              "sport gimnastikasi", "kurash", "bokschi", "suzish"],
    'qishloq': ["qishloq", "dehqonchilik", "agrar", "agronomiya", "vetenerinariya",
                "chorvachilik", "oziq-ovqat", "paxtachilik", "sabzavotchilik",
                "mevachilik", "ekologiya", "atrof-muhit", "suv xojaligi",
                "melioratsiya", "o'rmon", "baliqchilik", "tabiat", "ovqatlanish"],
    'turizm': ["turizm", "mehmondo'stlik", "hotel", "restoran", "mehmonxona",
               "sayohat", "xizmat kursatish", "ovqatlanish", "ospitality"],
  };

  /**
   * Kalit so'zni kengaytirish — agar kategoriya nomi berilsa, barcha aloqador terminlarni qaytaradi.
   * 
   * MUHIM: includes() o'rniga word-boundary regex ishlatamiz, aks holda "tarjima" tarkibidagi
   * "it" substringi sabab IT kategoriyasiga o'tib ketadi!
   * 
   * Misol: "tibbiyot" → ["tibbiyot", "stomatolog", "farmatsevtika", "davolash", ...]
   * "IT" → ["suniy intellekt", "axborot texnolog", "dasturlash", "kiberxavfsizlik", ...]
   * "dasturlash" (kategoriya emas) → ["dasturlash"] (o'zini qaytaradi)
   */
  private expandSearchKeyword(keyword: string): string[] {
    const lower = keyword.toLowerCase().trim();
    
    // so'z chegarasi bilan tekshiramiz — "it" "tarjima" ichida bo'lsa ham false qaytaradi!
    const matchesCategory = (word: string, cat: string): boolean => {
      // 'it', 'ai' kabi qisqa kategoriyalar uchun so'z chegarasi muhim
      const pattern = new RegExp('\\b' + cat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      return pattern.test(word);
    };
    
    // Avval aniq kategoriya nomi bo'yicha tekshiramiz
    for (const [category, terms] of Object.entries(this.CATEGORY_KEYWORDS)) {
      if (lower === category || matchesCategory(lower, category)) {
        console.log(`[Expand] "${keyword}" → kategoriya "${category}" → ${terms.length} ta term`);
        return terms;
      }
    }
    
    // Agar kengaytirilmagan termin bo'lsa (masalan "dasturlash" — bu 
    // CATEGORY_KEYWORDS dan emas, lekin yo'nalishlarda bor)
    // Uni o'zidek qaytaramiz — keyin matching da ishlatiladi
    return [lower];
  }

  /**
   * Location_uz matnini region ID ga map qilish
   */
  private normalizeSearchText(text: string): string {
    return text.toLowerCase()
      .replace(/insituti/g, 'institut')
      .replace(/instituti/g, 'institut')
      .replace(/insitute/g, 'institut')
      .replace(/institution/g, 'institut')
      .replace(/universitei/g, 'universiteti')
      .replace(/universitela/g, 'universitetlar')
      .replace(/unversitet/g, 'universitet')
      .replace(/unniversitet/g, 'universitet')
      .replace(/univ\s+ersitet/g, 'universitet')
      .replace(/shax(r|ri)/g, 'shahri')
      .trim();
  }

  private normalizeSearchWord(word: string): string {
    return word.toLowerCase()
      .replace(/insituti/g, 'institut')
      .replace(/instituti/g, 'institut')
      .replace(/insitute/g, 'institut')
      .replace(/institution/g, 'institut')
      .replace(/unversitet/g, 'universitet')
      .replace(/unniversitet/g, 'universitet')
      .trim();
  }

  private mapLocationToRegion(locationUz: string): number | null {
    if (!locationUz) return null;
    const l = locationUz.toLowerCase().trim();
    for (const [key, id] of Object.entries(this.REGION_MAP)) {
      if (l.includes(key)) return id;
    }
    return 15; // Boshqa
  }
  async execute(intent: IntentResult, sessionContext?: any, userMessage?: string): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    try {
      switch (intent.intent) {
        case "university_search":
          results.push(await this.searchUniversity(intent, userMessage));
          break;

        case "direction_search":
          results.push(await this.searchDirection(intent, sessionContext, userMessage));
          break;

        case "grant_search":
          results.push(await this.searchGrants(intent));
          break;

        case "news_search":
          results.push(await this.searchNews(intent));
          break;

        case "comparison":
          results.push(await this.compareUniversities());
          break;

        case "recommendation":
          results.push(await this.recommend(intent, sessionContext, userMessage));
          break;

        case "admission":
          results.push(await this.getAdmissionInfo(intent));
          break;

        case "transfer":
          results.push(await this.getTransferInfo(intent));
          break;

        case "faq":
        case "greeting":
        case "unknown":
          results.push({ tool: "none" as any, success: true });
          break;
      }
    } catch (error: any) {
      console.error("[Tool Router Error]", error);
      results.push({
        tool: intent.intent as any,
        success: false,
        error: error.message || "Tool execution failed",
      });
    }

    return results;
  }

  private async searchUniversity(intent: IntentResult, userMessage?: string): Promise<ToolResult> {
    const { university, region, institutionCategory, accommodation } = intent.entities;

    try {
      // Step 1: /universities/filter orqali barcha universitetlarni olish
      // Eslatma: API filter endpointi hech qanday parametrni qo'llab-quvvatlamaydi,
      // har doim barcha 152 universitetni qaytaradi (faqat asosiy maydonlar bilan)
      const filterResult = await externalApi.getUniversitiesFilter({ limit: 200 });

      let universitiesList: any[] = [];
      if (Array.isArray(filterResult?.data)) {
        universitiesList = filterResult.data;
      } else if (Array.isArray(filterResult)) {
        universitiesList = filterResult;
      } else if (filterResult?.entities && Array.isArray(filterResult.entities)) {
        universitiesList = filterResult.entities;
      }

      if (universitiesList.length === 0) {
        return { tool: "search_university" as any, success: true, data: [] };
      }

      // Agar aniq universitet nomi berilgan bo'lsa, nomi bo'yicha filtrlaymiz
      if (university) {
        const searchTerm = university.toLowerCase();
        universitiesList = universitiesList.filter((u: any) =>
          (u.full_name_uz || '').toLowerCase().includes(searchTerm) ||
          (u.full_name_en || '').toLowerCase().includes(searchTerm) ||
          (u.abbr_name_uz || '').toLowerCase().includes(searchTerm) ||
          (u.slug || '').toLowerCase().includes(searchTerm)
        );
      } else {
        // Entity orqali topilmasa, userMessage dan to'liq universitet nomini qidirish
        // Masalan: "Toshkent davlat yuridik universitetida grant bormi" → 
        // filter dagi full_name_uz bilan solishtirib topamiz
        const msgLower = (userMessage || '').toLowerCase();
        if (msgLower) {
          // Avval aniq university_id qidirilgan bo'lsa (context dan)
          // yoki message da 'universitet' so'zidan oldingi qismni olish
          const normalizedMsg = this.normalizeSearchText(msgLower);
          const uniNameStart = normalizedMsg.match(/(.+?)\s+(universiteti?|institut|instituti|oliygoh|oliygohi?|akademiya|kollej)(da|ning|ga|ni|dan|dagi)?(\s|$)/i);
          const searchName = uniNameStart 
            ? uniNameStart[1].trim() 
            : normalizedMsg.replace(/\b(haqida|ma'lumot|qachon|necha|qancha|barcha|jami|umumiy|bor|bormi|ro'yxati|qanday|qayer|kerak|uchun|info|ma'lumot|haqida)\b/gi, '').trim();
           
          if (searchName && searchName.length > 4) {
            // Barcha universitetlar nomini message bilan solishtirish
            // MUHIM: SO'Z ASOSIDA matching — substring emas!
            // "toshkent shahri turin politexnika" → university nomidagi
            // KAMIDA 2 TA muhim so'z topilishi kerak.
            //
            // NEGA substring emas? "shahri" vs "shahridagi" farqida
            // substring matching "shahri" ni "shahridagi" ichida topmaydi!
            //
            // NEGA startsWith? "shahri" "shahridagi" ni prefix sifatida topadi.
            const searchWords = searchName.split(/\s+/)
              .map((w: string) => this.normalizeSearchWord(w))
              .filter((w: string) => w.length > 2);
             
            const fullMatches = universitiesList.filter((u: any) => {
              const fullName = this.normalizeSearchText((u.full_name_uz || '').toLowerCase());
              const uniWords = fullName.split(/\s+/).map((w: string) => this.normalizeSearchWord(w)).filter((w: string) => w.length > 2);
               
              let matchCount = 0;
              for (const sw of searchWords) {
                if (uniWords.some((uw: string) => uw.startsWith(sw))) {
                  matchCount++;
                }
              }
               
              const threshold = Math.max(1, Math.ceil(searchWords.length * 0.6));
              return matchCount >= threshold;
            });
             
            if (fullMatches.length >= 1) {
              universitiesList = fullMatches;
            } else if (searchWords.length > 0) {
              const fuzzyMatches = universitiesList.filter((u: any) => {
                const fullName = this.normalizeSearchText((u.full_name_uz || '').toLowerCase());
                return searchWords.every((sw: string) => fullName.includes(sw));
              });
              if (fuzzyMatches.length > 0) {
                universitiesList = fuzzyMatches;
              }
            }
          }
        }
      }

      // MUHIM: Agar nom bo'yicha filtrlangandan keyin 1 ta universitet qolgan bo'lsa,
      // uni to'g'ridan-to'g'ri user-side/{id} orqali to'liq ma'lumotini olamiz
      // Kategoriya/region filtrlashni o'tkazib yuboramiz (chunki kategoriya va region
      // entity orqali qo'shilgan bo'lsa, ular LIST uchun, aniq universitet uchun EMAS)
      if (universitiesList.length === 1) {
        const uniId = universitiesList[0].id;
        const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
        try {
          const fullDetail = await Promise.race([externalApi.getUniversityUserSide(uniId), timeout(5000)]);
          if (fullDetail && fullDetail.id) {
            return { tool: "search_university" as any, success: true, data: this.normalizeUniversity(fullDetail) };
          }
        } catch { /* user-side ishlamasa, filter ma'lumotini ishlat */ }
        
        // AGAR user-side API ishlamasa, filterdagi basic ma'lumot bilan qaytaramiz
        // Bu MUHIM: "Turin Politexnika universiteti haqida" desa, 1 ta natija topilgan,
        // keyin user-side timeout bo'lsa, "### 🏛 Universitetlar ro'yxati" (LIST) emas,
        // balki single-uni format chiqishi kerak!
        const basicUni = universitiesList[0];
        return { 
          tool: "search_university" as any, 
          success: true, 
          data: [{
            id: basicUni.id,
            slug: basicUni.slug,
            fullNameUz: basicUni.full_name_uz || '',
            fullNameEn: basicUni.full_name_en || '',
            location: basicUni.location_uz || '',
            institutionCategory: basicUni.institution_category_id 
              ? lookupManager.getCategoryName(basicUni.institution_category_id, 'uz') 
              : '',
            hasGrant: false,
            hasAccommodation: false,
            descriptionUz: '',
          }]
        };
      }

      // Region filtrini saqlaymiz (keyinroq user-side ma'lumot bilan ishlatish uchun)
      const targetRegionName = region ? lookupManager.getRegionName(parseInt(region), 'uz').toLowerCase() : null;

      // Agar region berilgan bo'lsa, universitet nomi bo'yicha taxminiy filtrlaymiz
      // Bu har doim ishlaydi (kategoriya bo'lsa ham) — user-side yukini kamaytirish uchun
      if (targetRegionName) {
        const shortName = targetRegionName.replace(' viloyati', '').replace(' shahri', '').replace(' respublikasi', '').trim();
        universitiesList = universitiesList.filter((u: any) =>
          (u.full_name_uz || '').toLowerCase().includes(shortName) ||
          (u.full_name_ru || '').toLowerCase().includes(shortName) ||
          (u.full_name_en || '').toLowerCase().includes(shortName)
        );
      }

      // Kategoriya (davlat/xususiy/xalqaro) bo'yicha filtrlash uchun
      // user-side/{id} orqali to'liq ma'lumot olish kerak
      // Barcha 152 talab uchun 152 ta API call qilmaslik uchun,
      // faqat birinchi 20 talab uchun user-side ma'lumotini olamiz
      let finalList: any[] = [];

      // Kategoriya va/yoki region bo'yicha filtrlash — user-side/{id} orqali to'liq ma'lumot olamiz
      if ((institutionCategory || targetRegionName) && universitiesList.length > 0) {
        const batchSize = Math.min(universitiesList.length, 50);
        const batch = universitiesList.slice(0, batchSize);

        const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

        const userSideResults = await Promise.allSettled(
          batch.map((u: any) =>
            Promise.race([externalApi.getUniversityUserSide(u.id), timeout(5000)])
          )
        );

        const enriched: any[] = [];
        for (const result of userSideResults) {
          if (result.status === 'fulfilled' && result.value?.id) {
            const uni = result.value;
            // Kategoriya bo'yicha tekshirish
            const catMatch = !institutionCategory || (uni.institution_category_id && uni.institution_category_id.toString() === institutionCategory);
            // Hudud bo'yicha tekshirish — asosiy shahar nomini solishtiramiz
            // Masalan: "Samarqand shahri" va "Samarqand viloyati" ikkalasi "samarqand" ga mos keladi
            const getBaseCity = (s: string) => s.replace(/ (viloyati|shahri|respublikasi)$/i, '').trim();
            const locLower = (uni.location_uz || '').toLowerCase();
            const locBase = getBaseCity(locLower);
            const targetBase = getBaseCity(targetRegionName || '');
            const locationMatch = !targetRegionName || locBase === targetBase || locLower.includes(targetRegionName);
            // Yotoqxona bo'yicha tekshirish — agar so'ralgan bo'lsa
            const accommodationMatch = !accommodation || uni.has_accomodation === true;
            if (catMatch && locationMatch && accommodationMatch) {
              enriched.push(this.normalizeUniversity(uni));
            }
          }
        }

        finalList = enriched;
        // HATTO finalList empty bo'lsa ham, overview bilan qaytaramiz
        // shunda foydalanuvchi "0+ universitet" emas, "152 ta universitet, 67 tasi davlat" kabi
        // aniq ma'lumotni ko'radi.
        if (finalList.length === 0) {
          const overview = await this.getUniversityOverview();
          if (overview && !university) {
            const regionData = region ? {
              regionId: parseInt(region),
              regionSpecific: overview.byRegion[parseInt(region)] || null,
            } : null;
            return {
              tool: "search_university" as any,
              success: true,
              data: { universities: [], universityOverview: overview, regionOverview: regionData },
            };
          }
          return { tool: "search_university" as any, success: true, data: [] };
        }
      } else {
        // Kategoriya filtri yo'q — faqat birinchi 20 talabni ko'rsatamiz
        if (universitiesList.length === 1) {
          const uniId = universitiesList[0].id;
          try {
            const fullDetail = await externalApi.getUniversityUserSide(uniId);
            if (fullDetail && fullDetail.id) {
              return { tool: "search_university" as any, success: true, data: this.normalizeUniversity(fullDetail) };
            }
          } catch { /* user-side ishlamasa, filter natijasini ishlat */ }
        }

        finalList = universitiesList.slice(0, 20).map((u: any) => ({
          id: u.id,
          slug: u.slug,
          fullNameUz: u.full_name_uz || '',
          fullNameEn: u.full_name_en || '',
        }));
      }

      // Umumiy savol yoki region bo'yicha savol bo'lsa — overview qo'shamiz
      // Aniq universitet nomi bilan so'ralganda ("TATU haqida") overview kerak emas — 152 ta API call tejaladi
      if (!university) {
        const overview = await this.getUniversityOverview();
        if (overview) {
          // Region bo'yicha so'ralgan bo'lsa, faqat o'sha region ma'lumotini qo'shamiz
          const regionData = region ? {
            regionId: parseInt(region),
            regionSpecific: overview.byRegion[parseInt(region)] || null,
          } : null;

          return {
            tool: "search_university" as any,
            success: true,
            data: {
              universities: finalList,
              universityOverview: overview,
              regionOverview: regionData,
            },
          };
        }
      }

      return {
        tool: "search_university" as any,
        success: true,
        data: finalList,
      };
    } catch (error: any) {
      console.warn("[University Search Error]", error?.message);
      return { tool: "search_university" as any, success: false, error: "Universitet ma'lumotlarini olishda xatolik" };
    }
  }

  /**
   * Yo'nalish bo'yicha qidiruv.
   *
   * MUHIM: /v1/directions/bot va /v1/directions endpointlari yo'nalishni
   * universitetga BOG'LAMAYDI (faqat id, name_uz, name_ru, name_en qaytaradi).
   * /v1/directions va /v1/directions/{id} esa oddiy "user" roli uchun 403 Forbidden
   * qaytaradi (faqat admin uchun ochiq).
   *
   * Yagona ishlaydigan yo'l — har bir universitet uchun alohida
   * GET /v1/directions/getAll/{universityId} chaqirish (bu 200 qaytaradi).
   * Shuning uchun bu funksiya:
   *   1. Barcha universitetlarni oladi
   *   2. Har biri uchun (cheklangan sonda, parallel) yo'nalishlarini oladi
   *   3. Foydalanuvchi kalit so'ziga mos yo'nalishlarni tanlaydi
   *   4. Mos universitetlarning to'liq (user-side) ma'lumotini qo'shib qaytaradi
   */
  private async searchDirection(intent: IntentResult, sessionContext?: any, userMessage?: string): Promise<ToolResult> {
    try {
      // 1. Barcha universitetlarni olish (nom + id)
      const uniResult = await externalApi.getUniversitiesFilter({ limit: 200 });
      let universities: any[] = [];
      if (Array.isArray(uniResult?.data)) {
        universities = uniResult.data;
      } else if (Array.isArray(uniResult)) {
        universities = uniResult;
      } else if (Array.isArray(uniResult?.entities)) {
        universities = uniResult.entities;
      }

      if (universities.length === 0) {
        return { tool: "search_direction" as any, success: true, data: { directions: [], universities: [], tuitionInfo: undefined } };
      }

      // 1.5. AGAR foydalanuvchi ma'lum bir universitet nomini aytgan bo'lsa — 
      // shu universitetning YO'NALISHLARINI to'g'ridan-to'g'ri olamiz
      // "Samarqand davlat universitetida qanday yo'nalishlar bor?
      const userMessageLower = (userMessage || '').toLowerCase();
      const targetUni = intent.entities.university;
      
      // University entity orqali yoki matndan universitet nomini topish
      let matchedUni: any = null;
      
      // Aniq universitet nomi berilgan bo'lsa, nomi bo'yicha qidiramiz
      if (targetUni) {
        matchedUni = universities.find((u: any) =>
          (u.full_name_uz || '').toLowerCase().includes(targetUni.toLowerCase()) ||
          (u.abbr_name_uz || '').toLowerCase() === targetUni.toLowerCase() ||
          (u.slug || '').toLowerCase().includes(targetUni.toLowerCase())
        );
      }
      
      // Agar entity orqali topilmasa, userMessage dagi "universitetida", "universiteti" 
      // so'zlaridan oldingi qismni olish orqali topamiz
      if (!matchedUni && userMessage) {
        // "... universitetida ..." yoki "... universiteti ..." dan oldingi so'zlarni olish
        const uniNameInMsg = userMessageLower.match(/(.+?)\s+universiteti(da|ni|ning|dagi)?/i);
        if (uniNameInMsg) {
          const searchName = uniNameInMsg[1].trim().toLowerCase();
          
          // BEST MATCH: includes orqali barcha mos universitetlarni topib, 
          // eng yaxshi mos keladiganini tanlaymiz
          // "Buxoro davlat" deyilsa, "Buxoro davlat tibbiyot universiteti" emas,
          // "Buxoro davlat universiteti" tanlanishi kerak
          const matches = universities.filter((u: any) =>
            (u.full_name_uz || '').toLowerCase().includes(searchName) ||
            (u.full_name_ru || '').toLowerCase().includes(searchName)
          );
          
          if (matches.length === 1) {
            matchedUni = matches[0];
          } else if (matches.length > 1) {
            // Score each match: shorter name = more specific match
            // "Buxoro davlat universiteti" (name length) vs "Buxoro davlat tibbiyot universiteti"
            // We want the one where searchName covers MORE of the full name (higher ratio)
            let bestScore = 0;
            for (const m of matches) {
              const name = (m.full_name_uz || '').toLowerCase();
              // Higher ratio = searchName is a larger portion of the name
              const score = searchName.length / name.length;
              if (score > bestScore) {
                bestScore = score;
                matchedUni = m;
              }
            }
          }
        }
      }

      // Agar aniq universitet topilsa, shu universitetning barcha yo'nalishlarini olamiz
      if (matchedUni) {
        const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
        const dirs = await Promise.race([externalApi.getDirectionsByUniversity(matchedUni.id), timeout(8000)]);
        
        if (Array.isArray(dirs) && dirs.length > 0) {
          // Universitetning to'liq ma'lumotini olamiz
          let uniDetail: any = null;
          try {
            uniDetail = await Promise.race([externalApi.getUniversityUserSide(matchedUni.id), timeout(5000)]);
          } catch {}
          
          const enrichedUnis = uniDetail?.id ? [this.normalizeUniversity(uniDetail)] : [];
          
          const directionNames = dirs.map((d: any) => ({
            id: d.id,
            nameUz: d.name_uz || '',
            nameEn: d.name_en || '',
            nameRu: d.name_ru || '',
            universityId: matchedUni.id,
            universityName: matchedUni.full_name_uz || '',
            universitySlug: matchedUni.slug || '',
          }));

          return {
            tool: "search_direction" as any,
            success: true,
            data: {
              directions: directionNames, // Barcha yo'nalish nomlari (cheklanmagan)
              universities: enrichedUnis,
              universityDirections: {
                universityName: matchedUni.full_name_uz || matchedUni.full_name_en || '',
                universitySlug: matchedUni.slug || '',
                totalCount: directionNames.length,
                directionNames: directionNames.map((d: any) => d.nameUz || d.nameEn || ''),
              },
              tuitionInfo: undefined,
            },
          };
        }
      }

      // 2. Foydalanuvchi matnidan kalit so'zni ajratib olish
      let searchKeyword = '';
      if (userMessage) {
        const cleaned = userMessage
          .toLowerCase()
          .replace(/\b(bilsan?mi|men|ga|ni|ning|da|dan|bilan|uchun|kerak|bor|haqida|qiziqaman|qiziqasiz|qiziqadi|qarayman|izlayman|top|ayt|ber|ko'rsat|universitet|universitetni|tavsiya|maslahat|bering|bersan(gizmi)?|bermoqchi)\b/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (cleaned.length > 1) {
          searchKeyword = cleaned;
        }
      }

      // 3. Har bir universitet uchun yo'nalishlarni olish (parallel, cheklangan, timeout bilan)
      const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
      const batch = universities.slice(0, 60);

      const directionResults = await Promise.allSettled(
        batch.map((u: any) =>
          Promise.race([externalApi.getDirectionsByUniversity(u.id), timeout(4000)]).then((dirs: any) => ({
            universityId: u.id,
            universityName: u.full_name_uz || u.fullNameUz || '',
            universitySlug: u.slug || '',
            dirs: Array.isArray(dirs) ? dirs : [],
          }))
        )
      );

      // 4. Kalit so'zni KENGAYTIRIB, barcha aloqador terminlar bo'yicha mos yo'nalishlarni topish
      // "tibbiyot" desa → tibbiyot, stomatolog, farmatsevtika, davolash, pediatriya...
      // "IT" desa → sun'iy intellekt, dasturlash, kiberxavfsizlik, kompyuter fan...
      const expandedTerms = searchKeyword ? this.expandSearchKeyword(searchKeyword) : [];
      
      const matches: any[] = [];
      for (const r of directionResults) {
        if (r.status === 'fulfilled') {
          const { universityId, universityName, universitySlug, dirs } = (r as any).value;
          for (const d of dirs) {
            const nameUz = (d.name_uz || '').toLowerCase();
            const nameEn = (d.name_en || '').toLowerCase();
            
            // Agar expandedTerms bo'lsa, HAR QANDAY terminga mos kelsa yetarli
            // Agar bo'lmasa, hamma yo'nalishlarni ko'rsatamiz
            const isMatch = expandedTerms.length > 0
              ? expandedTerms.some((term: string) => nameUz.includes(term) || nameEn.includes(term))
              : true;
            if (isMatch) {
              matches.push({
                id: d.id,
                nameUz: d.name_uz,
                nameEn: d.name_en,
                universityId,
                universityName,
                universitySlug,
              });
            }
          }
        }
      }

      // 5. Mos universitetlarning to'liq ma'lumotini olish (ko'pi bilan 5 ta)
      const uniqueUniIds = Array.from(new Set(matches.map((m) => m.universityId))).slice(0, 5);
      const uniDetails = await Promise.allSettled(
        uniqueUniIds.map((id: any) =>
          Promise.race([externalApi.getUniversityUserSide(id), timeout(4000)])
        )
      );

      const enrichedUniversities = uniDetails
        .filter((r) => r.status === 'fulfilled' && (r as any).value?.id)
        .map((r: any) => this.normalizeUniversity(r.value));

      const tuitionRange = await this.fetchTuitionContext();

      return {
        tool: "search_direction" as any,
        success: true,
        data: {
          directions: matches.slice(0, 15),
          universities: enrichedUniversities,
          tuitionInfo: tuitionRange,
        },
      };
    } catch (error) {
      return { tool: "search_direction" as any, success: false, error: "Yo'nalish ma'lumotlarini olishda xatolik" };
    }
  }

  private async searchGrants(intent: IntentResult): Promise<ToolResult> {
    const { university, region } = intent.entities;

    try {
      const result = await externalApi.getGrants({
        university: university?.toLowerCase(),
        region: region ? lookupManager.getRegionName(parseInt(region), "uz") : undefined,
        limit: 20,
      });

      const grants = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];

      return {
        tool: "search_grants" as any,
        success: true,
        data: grants.map((g: any) => {
          // Handle both snake_case and camelCase API responses
          const grant = this.normalizeKeys(g);
          return {
            ...grant,
            grantDescUz: grant.grantDescUz?.substring(0, 500) || grant.grant_desc_uz?.substring(0, 500),
          };
        }),
      };
    } catch (error) {
      return { tool: "search_grants" as any, success: false, error: "Grant ma'lumotlarini olishda xatolik" };
    }
  }

  private async searchNews(intent: IntentResult): Promise<ToolResult> {
    try {
      const result = await externalApi.getNews({ limit: 10 });
      const news = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];

      return {
        tool: "search_news" as any,
        success: true,
        data: news.map((n: any) => this.normalizeKeys(n)),
      };
    } catch (error) {
      return { tool: "search_news" as any, success: false, error: "Yangilik ma'lumotlarini olishda xatolik" };
    }
  }

  private async compareUniversities(): Promise<ToolResult> {
    try {
      // Filterdan 10 ta universitet olamiz
      const result = await externalApi.getUniversitiesFilter({ limit: 10 });
      let universities = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];

      // Batafsil ma'lumot olish uchun user-side/{id} dan olamiz
      const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
      const userSideResults = await Promise.allSettled(
        universities.slice(0, 5).map((u: any) =>
          Promise.race([externalApi.getUniversityUserSide(u.id), timeout(5000)])
        )
      );

      const comparisonData: any[] = [];
      for (const result of userSideResults) {
        if (result.status === 'fulfilled' && result.value?.id) {
          const uni = this.normalizeUniversity(result.value);
          comparisonData.push({
            id: uni.id,
            name: uni.fullNameUz || uni.fullNameEn,
            slug: uni.slug,
            type: uni.institutionCategory || lookupManager.getCategoryName(4, 'uz'),
            location: uni.location || '',
            hasGrant: uni.hasGrant,
            hasAccommodation: uni.hasAccommodation,
            tuition: uni.tuition || 'N/A',
            directionCount: uni.directionCount || 0,
            studentsCount: uni.studentsCount || 0,
            isOpenForAdmission: uni.isOpenForAdmission,
            website: uni.website,
            phone: uni.admissionPhone || uni.phone,
            educationTypes: uni.educationTypes,
            degrees: uni.degrees,
            educationLanguages: uni.educationLanguages,
          });
        }
      }

      return {
        tool: "compare_universities" as any,
        success: true,
        data: comparisonData,
      };
    } catch (error) {
      return { tool: "compare_universities" as any, success: false, error: "Taqqoslash ma'lumotlarini olishda xatolik" };
    }
  }

  private async getAdmissionInfo(intent: IntentResult): Promise<ToolResult> {
    const { university } = intent.entities;

    try {
      const result = await externalApi.getUniversitiesFilter({
        search: university || undefined,
        limit: 10,
      });

      const universities = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];

      return {
        tool: "get_university" as any,
        success: true,
        data: universities.map((u: any) => ({
          name: u.full_name_uz || u.fullNameUz,
          isOpen: u.is_open_for_admission ?? u.isOpenForAdmission,
          startDate: u.admission_start_date || u.admissionStartDate,
          deadline: u.admission_deadline || u.admissionDeadline,
          quota: u.current_quota ?? u.currentQuota,
          phone: u.admission_phone || u.admissionPhone,
        })),
      };
    } catch (error) {
      return { tool: "get_university" as any, success: false, error: "Qabul ma'lumotlarini olishda xatolik" };
    }
  }

  private async getTransferInfo(intent: IntentResult): Promise<ToolResult> {
    try {
      const result = await externalApi.getDirectionsBot({ limit: 20 });
      const directions = Array.isArray(result) ? result : (Array.isArray(result?.data) ? result.data : []);

      return {
        tool: "search_direction" as any,
        success: true,
        data: directions
          .filter((d: any) => d.is_study_transferable ?? d.isStudyTransferable)
          .map((d: any) => ({
            name: d.name_uz || d.nameUz,
            university: d.university?.full_name_uz || d.university?.fullNameUz || "",
            transferStartDate: d.transfer_start_date || d.transferStartDate,
            transferEndDate: d.transfer_end_date || d.transferEndDate,
          })),
      };
    } catch (error) {
      return { tool: "search_direction" as any, success: false, error: "Ko'chirish ma'lumotlarini olishda xatolik" };
    }
  }

  /**
   * REKOMENDATSIYA TIZIMI — "universitet tavsiya qil", "qayerda o'qish kerak", "maslahat".
   *
   * Foydalanuvchi nimani xohlayotganini aniqlash uchun:
   * 1. Intent classifier entities + sessionContext dan ma'lumotlarni yig'adi
   * 2. Agar muhim ma'lumotlar yetishmasa, needsClarification = true qaytaradi
   * 3. Barcha ma'lumotlar mavjud bo'lsa, mos universitet + yo'nalish + grant ma'lumotlarini birlashtiradi
   */
  private async recommend(intent: IntentResult, sessionContext?: any, userMessage?: string): Promise<ToolResult> {
    try {
      // ===== 1. Foydalanuvchi PREFERENCES ni yig'ish =====
      const preferences: {
        region?: string;           // location ID or name
        directionCategory?: string; // it, tibbiyot, iqtisod...
        institutionCategory?: string; // 3=davlat, 4=xususiy, 5=xalqaro
        degree?: string;
        educationType?: string;
        language?: string;
        interestGrant?: boolean;
        interestAccommodation?: boolean;
      } = {};

      // Intent entities dan olish
      const entities = intent.entities || {};
      if (entities.region) preferences.region = entities.region;
      if (entities.institutionCategory) preferences.institutionCategory = entities.institutionCategory;
      if (entities.degree) preferences.degree = entities.degree;
      if (entities.educationType) preferences.educationType = entities.educationType;
      if (entities.language) preferences.language = entities.language;
      if (entities.grantType) preferences.interestGrant = true;
      if (entities.accommodation === "true") preferences.interestAccommodation = true;

      // Session context dan olish
      if (sessionContext) {
        if (!preferences.region && sessionContext.currentRegion) preferences.region = sessionContext.currentRegion;
        if (!preferences.institutionCategory && sessionContext.currentInstitutionCategory) 
          preferences.institutionCategory = sessionContext.currentInstitutionCategory;
        if (!preferences.degree && sessionContext.currentDegree) preferences.degree = sessionContext.currentDegree;
        if (sessionContext.interestGrant) preferences.interestGrant = true;
      }

      // User message dan direction category ni aniqlash
      // MUHIM: includes(cat) ishlatilmaydi — "tarjima" tarkibidagi "it" sabab IT ga tushib ketadi!
      const msgLower = (userMessage || '').toLowerCase();
      const categoryKeywords = Object.keys(this.CATEGORY_KEYWORDS);
      for (const cat of categoryKeywords) {
        const escapedCat = cat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp('\\b' + escapedCat + '\\b', 'i').test(msgLower)) {
          preferences.directionCategory = cat;
          break;
        }
      }

      // ===== 2. MUHIM ma'lumotlar tekshiruvi =====
      const missing: string[] = [];
      if (!preferences.region) missing.push("region");
      if (!preferences.directionCategory) missing.push("directionCategory");
      if (!preferences.institutionCategory) missing.push("institutionCategory");

      // Agar haligacha yetarli ma'lumot bo'lmasa → clarification so'raymiz
      // Agar hech bo'lmasa directionCategory bo'lsa, qolgan ma'lumotlarsiz ham qidirishni boshlaymiz
      if (missing.length > 0 && !preferences.directionCategory) {
        return {
          tool: "recommend" as any,
          success: true,
          data: {
            needsClarification: true,
            preferences: {
              known: preferences,
              missing: missing,
            },
          },
        };
      }

      // ===== 3. MA'LUMOTLARNI YIG'ISH =====
      // Universitetlarni olish (filter orqali)
      const filterResult = await externalApi.getUniversitiesFilter({ limit: 200 });
      let universities: any[] = [];
      if (Array.isArray(filterResult?.data)) universities = filterResult.data;
      else if (Array.isArray(filterResult)) universities = filterResult;

      if (universities.length === 0) {
        return { tool: "recommend" as any, success: true, data: { recommendations: [], preferences } };
      }

      const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

      // Kategoriya va region bo'yicha filtr uchun user-side ma'lumotini olamiz
      const userSideBatch = universities.slice(0, 60);
      const userSideResults = await Promise.allSettled(
        userSideBatch.map((u: any) =>
          Promise.race([externalApi.getUniversityUserSide(u.id), timeout(5000)])
        )
      );

      // Mos universitetlarni topish
      const matchedUniversities: any[] = [];
      for (const result of userSideResults) {
        if (result.status === 'fulfilled' && result.value?.id) {
          const uni = result.value;
          const catId = uni.institution_category_id;

          // Kategoriya filtri
          if (preferences.institutionCategory && catId?.toString() !== preferences.institutionCategory) continue;

          // Region filtri
          if (preferences.region) {
            const locLower = (uni.location_uz || '').toLowerCase();
            const regionName = lookupManager.getRegionName(parseInt(preferences.region), 'uz').toLowerCase();
            const getBase = (s: string) => s.replace(/ (viloyati|shahri|respublikasi)$/i, '').trim();
            if (!locLower.includes(getBase(regionName)) && getBase(locLower) !== getBase(regionName)) continue;
          }

          matchedUniversities.push(uni);
        }
      }

      // Mos universitetlar bo'yicha yo'nalishlarni olish
      const matchedDirUnis = matchedUniversities.slice(0, 5);
      const matchedDirections: any[] = [];
      
      if (preferences.directionCategory && matchedDirUnis.length > 0) {
        const expandedTerms = this.expandSearchKeyword(preferences.directionCategory);
        
        // Store uni info alongside each request so we can use it in the result
        const dirRequests = matchedDirUnis.map((u: any) => ({
          uni: u,
          request: Promise.race([externalApi.getDirectionsByUniversity(u.id), timeout(4000)]),
        }));
        
        const dirResults = await Promise.allSettled(
          dirRequests.map((r) => r.request)
        );

        dirResults.forEach((r, idx) => {
          if (r.status === 'fulfilled' && Array.isArray(r.value)) {
            const uni = dirRequests[idx].uni;
            for (const d of r.value) {
              const nameUz = (d.name_uz || '').toLowerCase();
              const nameEn = (d.name_en || '').toLowerCase();
              if (expandedTerms.some((term: string) => nameUz.includes(term) || nameEn.includes(term))) {
                matchedDirections.push({
                  id: d.id,
                  nameUz: d.name_uz,
                  nameEn: d.name_en,
                  universityId: uni.id,
                  universityName: uni.full_name_uz || uni.full_name_en || '',
                  universitySlug: uni.slug || '',
                });
              }
            }
          }
        });
      }

      // Grant ma'lumotini olish
      let grants: any[] = [];
      if (preferences.interestGrant) {
        try {
          const grantResult = await externalApi.getGrants({ region: preferences.region ? lookupManager.getRegionName(parseInt(preferences.region), "uz") : undefined, limit: 10 });
          grants = Array.isArray(grantResult?.data) ? grantResult.data : [];
        } catch {}
      }

      // ===== 4. NATIJANI FORMATLASH =====
      const enrichedUnis = matchedUniversities.slice(0, 5).map((u: any) => this.normalizeUniversity(u));

      return {
        tool: "recommend" as any,
        success: true,
        data: {
          preferences,
          recommendations: enrichedUnis,
          directions: matchedDirections.slice(0, 20),
          grants: grants.slice(0, 5),
        },
      };
    } catch (error: any) {
      console.warn("[Recommend Error]", error);
      return { tool: "recommend" as any, success: false, error: "Tavsiya ma'lumotlarini olishda xatolik" };
    }
  }

  private normalizeUniversity(uni: any): any {
    // Mentalaba API returns snake_case fields
    // normalizeKeys converts to camelCase
    const u = this.normalizeKeys(uni);

    // Parse founded_year which comes as ISO date string
    let foundedYear: number | undefined;
    if (u.foundedYear) {
      const d = new Date(u.foundedYear);
      if (!isNaN(d.getTime())) foundedYear = d.getFullYear();
      else foundedYear = parseInt(u.foundedYear) || undefined;
    }

    // Gallery comes as array of path strings, convert to objects
    const gallery = Array.isArray(u.gallery)
      ? u.gallery.map((img: any, i: number) => ({
          id: i,
          imageUrl: typeof img === 'string' ? img : img?.image_url || img?.imageUrl || '',
        }))
      : [];

    // Education types, degrees, languages come as [{id: number|null}]
    const educationTypes = (u.educationType || [])
      .filter((e: any) => e?.id)
      .map((e: any) => ({
        id: e.id,
        name: lookupManager.getEducationTypeName(e.id, 'uz'),
      }));

    const degrees = (u.degree || [])
      .filter((d: any) => d?.id)
      .map((d: any) => ({
        id: d.id,
        name: lookupManager.getDegreeName(d.id, 'uz'),
      }));

    const educationLanguages = (u.educationLanguage || [])
      .filter((l: any) => l?.id)
      .map((l: any) => ({
        id: l.id,
        name: lookupManager.getEducationLanguageName(l.id, 'uz'),
      }));

    // Strip HTML from descriptions
    const stripHtml = (html: string) => html?.replace(/<[^>]*>/g, '').trim() || '';

    return {
      id: u.id,
      slug: u.slug,
      fullNameUz: u.fullNameUz || '',
      fullNameRu: u.fullNameRu || '',
      fullNameEn: u.fullNameEn || '',
      abbrNameUz: u.abbrNameUz || '',
      abbrNameEn: u.abbrNameEn || '',
      // Description contains HTML - strip it for AI
      descriptionUz: stripHtml(u.descriptionUz).substring(0, 2500),
      descriptionRu: stripHtml(u.descriptionRu).substring(0, 2500),
      descriptionEn: stripHtml(u.descriptionEn).substring(0, 2500),
      logo: u.logo,
      // institution_category_id is present in API
      institutionCategory: u.institutionCategoryId
        ? lookupManager.getCategoryName(u.institutionCategoryId, 'uz')
        : (u.institutionType === 'university' ? 'Universitet' : ''),
      institutionType: u.institutionType,
      // Location comes as string (location_uz), not ID
      location: u.locationUz || u.locationRu || u.locationEn || '',
      locationUz: u.locationUz || '',
      locationRu: u.locationRu || '',
      locationEn: u.locationEn || '',
      phone: u.phone || u.admissionPhone || '',
      email: u.email || u.supportEmail || '',
      website: u.webSite || u.website || '',
      supportEmail: u.supportEmail || '',
      foundedYear,
      studentsCount: u.studentsCount || 0,
      minimalTuitionFee: u.minimalTuitionFee,
      maximalTuitionFee: u.maximalTuitionFee,
      tuition: u.minimalTuitionFee && u.maximalTuitionFee
        ? `${(u.minimalTuitionFee / 1000000).toFixed(0)} - ${(u.maximalTuitionFee / 1000000).toFixed(0)} mln so'm`
        : u.minimalTuitionFee
          ? `${(u.minimalTuitionFee / 1000000).toFixed(0)} mln so'm`
          : "N/A",
      addressUz: u.addressUz || '',
      addressRu: u.addressRu || '',
      addressEn: u.addressEn || '',
      latitude: u.latitude ? parseFloat(u.latitude) : undefined,
      longitude: u.longitude ? parseFloat(u.longitude) : undefined,
      hasGrant: u.hasGrant ?? false,
      aboutGrantUz: u.aboutGrantUz || '',
      aboutGrantRu: u.aboutGrantRu || '',
      aboutGrantEn: u.aboutGrantEn || '',
      hasAccommodation: u.hasAccomodation ?? u.hasAccommodation ?? false,
      isPartner: u.isPartner ?? false,
      isOpenForAdmission: u.isOpenForAdmission ?? false,
      isPromoted: u.isPromoted === 1 || u.isPromoted === true,
      currentQuota: u.currentQuota,
      directionCount: u.directionCount,
      admissionPhone: u.admissionPhone || '',
      admissionStartDate: u.admissionStartDate,
      admissionDeadline: u.admissionDeadline,
      gallery,
      educationTypes,
      degrees,
      educationLanguages,
      certificationLink: u.certificationLink,
      accreditationCertificate: u.accreditationCertificate,
      instagramUsername: u.instagramUsername,
      telegramUsername: u.telegramUsername,
      facebookUsername: u.facebookUsername,
      linkedinUsername: u.linkedinUsername,
      youtubeUsername: u.youtubeUsername,
      domain: u.domain,
      groupChatId: u.groupChatId,
      responseTime: u.responseTime,
      isBanned: u.isBanned ?? false,
      representativeFullName: u.representativeFullName,
      leadLimit: u.leadLimit,
    };
  }

  private normalizeKeys(obj: any): any {
    if (!obj || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.normalizeKeys(item));

    const normalized: any = {};

    for (const [key, value] of Object.entries(obj)) {
      // Convert snake_case to camelCase
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      normalized[camelKey] = value;
    }

    return normalized;
  }

  /**
   * Universitetlarning real narx ma'lumotlarini yuklaydi.
   * Bu yo'nalish narxlari so'ralganda AI ga aniq ma'lumot berish uchun kerak.
   */
  private async fetchTuitionContext(): Promise<{
    hasData: boolean;
    minTuition?: number;
    maxTuition?: number;
    universities: Array<{ name: string; tuition: string; slug: string }>;
  }> {
    try {
      const result = await externalApi.getUniversitiesFilter({ limit: 200 });
      let universities = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
      if (Array.isArray(result?.entities)) universities = result.entities;

      // Faqat 5 ta universitetning user-side ma'lumotini olamiz
      const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
      const userSideResults = await Promise.allSettled(
        universities.slice(0, 5).map((u: any) =>
          Promise.race([externalApi.getUniversityUserSide(u.id), timeout(5000)])
        )
      );

      const uniTuitions: Array<{ name: string; tuition: string; slug: string; min: number; max: number }> = [];
      for (const r of userSideResults) {
        if (r.status === 'fulfilled' && r.value?.id) {
          const u = this.normalizeUniversity(r.value);
          if (u.minimalTuitionFee || u.maximalTuitionFee) {
            uniTuitions.push({
              name: u.fullNameUz || u.fullNameEn,
              tuition: u.tuition,
              slug: u.slug,
              min: u.minimalTuitionFee || 0,
              max: u.maximalTuitionFee || 0,
            });
          }
        }
      }

      if (uniTuitions.length === 0) {
        return { hasData: false, universities: [] };
      }

      const minTuition = Math.min(...uniTuitions.map((u) => u.min > 0 ? u.min : u.max));
      const maxTuition = Math.max(...uniTuitions.map((u) => u.max));

      return {
        hasData: true,
        minTuition,
        maxTuition,
        universities: uniTuitions.slice(0, 3).map((u) => ({
          name: u.name,
          tuition: u.tuition,
          slug: u.slug,
        })),
      };
    } catch (error) {
      console.warn('[Tuition Context Error]', error);
      return { hasData: false, universities: [] };
    }
  }

  /**
   * Barcha universitetlar soni, kategoriya bo'yicha va viloyatlar bo'yicha tahlilini yuklaydi.
   * Ma'lumotlarni 30 daqiqa davomida cache qiladi (30 daqiqada 1 marta 152 ta API call).
   * 
   * 152 ta universitetni parallel (30 tadan batch) user-side/{id} orqali yuklab:
   * - Kategoriya (davlat=3, xususiy=4, xalqaro=5)
   * - Viloyat (location_uz asosida 15 ta region)
   * - Har bir viloyat ichida kategoriya bo'yicha
   * ma'lumotlarini hisoblaydi.
   */
  private async getUniversityOverview(): Promise<{
    totalCount: number;
    categories: { state: number; private: number; international: number };
    universityExamples: Array<{ name: string; slug: string; type: string }>;
    byRegion: Record<number, { total: number; state: number; private: number; international: number }>;
  } | null> {
    // Cache dan qaytarish
    if (this.overviewCache.data && Date.now() - this.overviewCache.data.fetchedAt < this.OVERVIEW_CACHE_TTL) {
      return this.overviewCache.data;
    }

    try {
      // 1. Barcha universitet ID larni olish
      const filterResult = await externalApi.getUniversitiesFilter({ limit: 200 });
      let allUnis: any[] = [];
      if (Array.isArray(filterResult?.data)) allUnis = filterResult.data;
      else if (Array.isArray(filterResult)) allUnis = filterResult;
      
      if (allUnis.length === 0) return null;

      const totalCount = allUnis.length;

      // 2. Har bir universitet uchun user-side/{id} ni parallel yuklash (30 tadan batch, 3s timeout)
      const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
      const allIds = allUnis.map((u: any) => u.id);
      const batchSize = 30;
      const catCounts: { 3: number; 4: number; 5: number } = { 3: 0, 4: 0, 5: 0 };
      const examples: any[] = [];
      
      // Region bo'yicha ma'lumot: 1-15 regionlar
      const byRegion: Record<number, { total: number; state: number; private: number; international: number }> = {};
      for (let r = 1; r <= 15; r++) {
        byRegion[r] = { total: 0, state: 0, private: 0, international: 0 };
      }

      for (let i = 0; i < allIds.length; i += batchSize) {
        const batch = allIds.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map((id: number) =>
            Promise.race([externalApi.getUniversityUserSide(id), timeout(3000)])
          )
        );

        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value?.id) {
            const uni = result.value;
            const catId = uni.institution_category_id;

            // Kategoriya bo'yicha
            if (catId === 3 || catId === 4 || catId === 5) {
              catCounts[catId as 3 | 4 | 5]++;
              if (examples.length < 6) {
                examples.push({
                  name: uni.full_name_uz || uni.full_name_en || '',
                  slug: uni.slug || '',
                  type: catId === 3 ? 'davlat' : catId === 4 ? 'xususiy' : 'xalqaro',
                });
              }
            }

            // Region bo'yicha
            const regionId = this.mapLocationToRegion(uni.location_uz || uni.location_en || '');
            if (regionId && byRegion[regionId]) {
              byRegion[regionId].total++;
              if (catId === 3) byRegion[regionId].state++;
              else if (catId === 4) byRegion[regionId].private++;
              else if (catId === 5) byRegion[regionId].international++;
            }
          }
        }
      }

      const overviewData = {
        totalCount,
        categories: {
          state: catCounts[3],
          private: catCounts[4],
          international: catCounts[5],
        },
        universityExamples: examples,
        byRegion,
        fetchedAt: Date.now(),
      };

      // Cache ga saqlash
      this.overviewCache.data = overviewData;

      return overviewData;
    } catch (error) {
      console.warn('[University Overview Error]', error);
      return null;
    }
  }
}

export const toolRouter = new ToolRouter();