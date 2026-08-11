import '@/lib/external-api-patch';
import type { ToolResult, IntentResult } from "@/types";
import { lookupManager } from "@/data/lookups";
import { externalApi } from "@/lib/external-api";
import { embeddingService } from "./embedding-service";
import { detectDirectionCategory } from "./direction-synonyms";
import { detectExactDirection, normalizeDirectionName } from "./exact-direction";
import { getIntentHandler } from "./intent-config";
import { normalizeUserText } from "./text-normalizer";

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

  // Entity ID map'lar — matchesAdvancedFilters uchun
  // (lookup ID'lar: Bakalavr=1, Magistr=2, Doktorantura=3, Ko'chirish=4;
  //  Ingliz=2, Rus=3, O'zbek=1; Kunduzgi=1, Sirtqi=2, Kechki=3, Masofaviy=4)
  private readonly DEGREE_ID_MAP: Record<string, number> = { bachelor: 1, master: 2, phd: 3, transfer: 4 };
  private readonly LANG_ID_MAP: Record<string, number> = { english: 2, russian: 3, uzbek: 1 };
  private readonly ET_ID_MAP: Record<string, number> = { "full-time": 1, "part-time": 2, evening: 3, distance: 4 };

  // BOSQICH 4 (JSON-driven config): intent-config.json dagi 'handler' kalitlarini
  // tool methodlariga bog'laydi. Yangi intent → mavjud handler'ga yo'naltiriladi
  // (kodga tegmasdan). Handler topilmasa 'none' qaytariladi.
  private readonly HANDLER_DISPATCH: Record<string, (intent: IntentResult, sessionContext?: any, userMessage?: string) => Promise<ToolResult>> = {
    search_university: (i, s, m) => this.searchUniversity(i, s, m),
    search_direction: (i, s, m) => this.searchDirection(i, s, m),
    list_directions: () => this.listDirections(),
    search_grants: (i, s) => this.searchGrants(i, s),
    search_news: (i) => this.searchNews(i),
    search_tuition: (i, s, m) => this.searchTuition(i, s, m),
    compare_universities: (i, _s, m) => this.compareUniversities(i, m),
    recommend: (i, s, m) => this.recommend(i, s, m),
    get_admission: (i, s) => this.getAdmissionInfo(i, s),
    get_transfer: (i) => this.getTransferInfo(i),
    explain_recommendation: (i, s) => this.explainRecommendation(i, s),
    none: async () => ({ tool: "none" as any, success: true }),
  };

  /**
   * QUERY RESOLVER natijasini intent'ga yopishtirish (BOSQICH 14):
   * provider-manager resolveQuery() chaqirib, natijani entities.queryType ga
   * yozadi — tool-router shu yerga qarab directionDetail rejimini yoqadi.
   */
  private queryDetailOnly(intent: IntentResult): boolean {
    return intent.entities?.queryType === "direction_detail";
  }

  /**
   * EXPLANATION (BOSQICH 14): "Nega aynan TATU?" / "Nima uchun shu?" —
   * backend hisoblagan score.reasons/nuances asosida javob beradi.
   * Qayta hisoblamaydi — recommend ishlaganda sessionContext.lastRecommendations'
   * ga saqlangan sabablarni qaytaradi.
   */
  private async explainRecommendation(
    intent: IntentResult,
    sessionContext?: any
  ): Promise<ToolResult> {
    const recs = sessionContext?.lastRecommendations;
    const uniEntity = intent.entities?.university;
    // REVIEWER FIX: tavsiya bo'lmasa success:false QAYTARILMAYDI — aks holda
    // formatter apiErrorResponse ("bog'lanish xatosi") ko'rsatadi. success:true
    // + university:null qaytadi → formatExplanation ning do'stona fallbacki
    // ("Avval biror universitet tavsiyasini oling...") chiqadi.
    if (!recs || recs.length === 0) {
      // REVIEWER FIX: "nega TATU narxi qimmat" kabi savollarda university entity
      // bor-u tavsiyalar yo'q — uni shunchaki "avval tavsiya oling" deyish
      // o'rniga university detail qidiramiz (tabiiy javob).
      if (uniEntity) {
        const uniIntent: IntentResult = {
          ...intent,
          intent: "university_detail" as any,
        };
        return this.searchUniversity(uniIntent, sessionContext);
      }
      return {
        tool: "explain_recommendation" as any,
        success: true,
        data: { university: null, score: null, recommendations: [] },
      };
    }
    const target = uniEntity
      ? recs.find(
          (r: any) =>
            r.name.toLowerCase().includes(String(uniEntity).toLowerCase()) ||
            String(uniEntity).toLowerCase().includes(r.name.toLowerCase())
        ) || recs[0]
      : recs[0];
    return {
      tool: "explain_recommendation" as any,
      success: true,
      data: {
        university: { name: target.name, slug: target.slug },
        score: target.score || null,
        recommendations: recs.slice(0, 3).map((r: any) => ({
          name: r.name,
          total: r.score?.total ?? null,
        })),
      },
    };
  }

  /**
   * LAST UNIVERSITY MEMORY (BOSQICH 11): ko'rsatilgan/ko'rilgan universitеtni
   * session'ga yozadi. Follow-up savollar ("uning narxlari qancha?",
   * "kontrakti qancha?", "telefoni?") shu universitеtga bog'lanadi.
   * search_university / search_direction / recommend / get_university /
   * search_tuition ishlaganda chaqiriladi.
   */
  private rememberUniversity(sessionContext: any, uni: any): void {
    if (!sessionContext || !uni) return;
    const name = uni?.fullNameUz || uni?.full_name_uz || uni?.fullNameEn || uni?.full_name_en || "";
    if (!name) return;
    sessionContext.lastUniversity = {
      id: uni.id,
      name,
      slug: uni.slug || undefined,
    };
  }

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
    // MUHIM (Fix: search aniqlik): "injiniring" IT'dan olib tashlandi — u
    // "Biologiya injiniringi", "Kimyo injiniringi" kabi false-positive beradi
    // ("dasturiy injiniring" va "kompyuter injiniring" aniq IT terminlari).
    // "information" generic termin (yakka o'zi yetarli emas) — "Health
    // Informatics" (TTA) endi IT natijasiga kirmaydi.
    // MUHIM (Fix: ranking): "it " (keyingi bo'sh joy bilan) HAM olib tashlandi —
    // u "Atrof-MUHIT muhandisligi" kabi nomlardagi "muhit " ichiga substring
    // bo'lib tushib, arxitektura/qurilish universitetini IT deb chiqarardi.
    'it': ["suniy intellekt", "sun'iy intellekt", "axborot texnolog", "dasturlash", "kiberxavfsizlik",
           "malumotlar", "data science", "kompyuter fan", "kompyuter injiniring", "raqamli", "software",
           "dasturiy injiniring", "information", "information systems", "axborot tizim", "computer",
           "web", "mobile", "cloud", "ai", "machine learning", "full stack",
           "fintech", "blokcheyn", "siber", "telekommunikatsiya"],
    // YANGI: Biotibbiyot / Biomedical — AI + tibbiyot, biologiya injiniringi
    // "AI yordamida tibbiyotda ishlamoqchiman" → biomedical yo'nalishlar
    'biomedical': ["bioinformatika", "biomedical", "tibbiy ai", "medical ai", "biologiya injiniringi",
                   "bioinjenering", "genomika", "biofizika", "computational biology",
                   "health informatics", "tibbiy texnologiya", "medical technology",
                   "tibbiy informatika", "farmakoinformatika", "biogen",
                   // Biomedical keng to'plami uchun tibbiyot + IT terminlarini ham tekshiramiz
                   "tibbiyot", "biologiya", "kimyo", "medical", "davolash"],
    'tibbiyot': ["tibbiyot", "stomatolog", "farmatsevtika", "davolash", "pediatriya",
                  "jarrohlik", "terapiya", "medical", "dentistry", "klinik",
                  "biologiya", "genetika", "anatomiya", "fiziologiya", "farmatsiya",
                  "xamshiralik", "sogliqni saqlash", "kardiologiya", "neyrologiya",
                  "akusherlik", "ginekologiya", "travmatologiya", "oftalmologiya",
                  "onkologiya", "dermatologiya", "venerologiya", "radiologiya",
                  "reabilitatsiya", "sanitariya", "epidemiologiya", "immunologiya"],
    'iqtisod': ["iqtisod", "moliya", "buxgalteriya", "bank ishi", "menejment",
                "marketing", "logistika", "finance", "economics", "audit",
                "soliq", "kredit", "investitsiya", "tijorat", "savdo",
                "business", "startap", "tadbirkor", "konsalting", "reklama"],
    'huquq': ["huquq", "yurisprudensiya", "yuridik", "yurist", "advokat", "sud ishi", "law", "legal",
              "prokuratura", "notarius", "huquqshunos", "jinoyat", "fuqaro",
              "konstitutsiya", "xalqaro huquq", "soliq huquqi"],
    'pedagogika': ["pedagogika", "talim", "okituvchi", "maktabgacha", "psixologiya",
                   "maxsus pedagogika", "defektologiya", "logopediya", "metodika",
                   "boshlangich talim", "jismoniy talim", "kasb talimi"],
    'muhandislik': ["muhandislik", "qurilish", "arxitektura", "energetika", "engineering",
                    "elektr", "mexanika", "texnologiya", "ishlab chiqarish",
                    "avtomatlashtirish", "robototexnika", "materialshunoslik",
                    "neft", "gaz", "konchilik", "metallurgiya", "geologiya",
                    "fizika", "kimyo", "biokimyo", "matematika", "mexatronika",
                    "astrofizika", "kimyoviy", "kimyo-texnologiya"],
    'tarix': ["tarix", "arxeologiya", "tarixshunoslik", "etnografiya", "manbashunoslik",
              "jahon tarixi", "vatan tarixi", "falsafa", "history", "archeology",
              // Pre-sort uchun: "Toshkent davlat sharqshunoslik universiteti" nomida
              // "tarix" so'zi yo'q — "sharqshunoslik" qo'shilmasa u 20 talikdan
              // tashqarida qolib, tarix so'rovida topilmay qolar edi.
              "sharqshunoslik"],
    'filologiya': ["filologiya", "tilshunoslik", "lingvistika", "tarjima", "chet tili",
                   "ingliz tili", "rus tili", "nemis tili", "fransuz tili", "xitoy tili",
                   "arab tili", "koreys tili", "yapon tili", "turk tili", "adabiyot",
                   "jurnalistika", "nashriyot", "muharrir", "matn"],
    'sanat': ["sanat", "san'at", "dizayn", "moda", "rassomlik", "musiqa", "madaniyat", "kino",
              "teatr", "xoreografiya", "raqs", "tasviriy sanat", "amaliy sanat",
              "grafika", "haykaltaroshlik", "foto", "video", "animatsiya",
              // MUHIM (Fix: konservatoriya): O'zbekiston davlat konservatoriyasi
              // (40 ta yo'nalish) butunlay musiqa univi, lekin terminlar "musiqa"/"sanat"
              // bilan chegaralangani uchun strongCount=3 chiqib, major-density
              // qoidasiga o'tmay qolardi. Musiqa ijrochiligi terminlari qo'shildi:
              "cholgu", "cholg'u", "ijrochilik", "vokal", "dirijyor", "dirijyorlik",
              "bastakor", "fortepiano", "xonandalik", "orkestr", "musiqashunos",
              "konservatoriya"],
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

  // MUHIM (Fix: search aniqlik): GENERIC terminlar — yakka o'zi bitta moslik
  // bersa, universitet false-positive hisoblanadi ("information" → "Health
  // Informatics" tibbiyot univini IT qilib chiqarmasligi uchun). Talab:
  // KAMIDA 1 ta specific moslik YOKI 2+ ta generic moslik.
  private readonly GENERIC_DIRECTION_TERMS = new Set([
    'it', 'ai', 'information', 'computer', 'malumotlar', 'raqamli',
    'web', 'mobile', 'cloud', 'telekommunikatsiya', 'texnolog', 'texnologiya',
    'injiniring', 'engineering', 'science', 'fan', 'xalqaro', 'international',
  ]);

  // REASONING V2 (Fix): zaif fan → qochish kerak bo'lgan yo'nalish termlari.
  // Foydalanuvchi "matematikam yaxshi emas" desa, matematika og'ir yo'nalishlar
  // (Kompyuter fanlari, Fizika...) kamroq mos hisoblanadi. Ball dan chegirma.
  private readonly WEAKNESS_AVOID_TERMS: Record<string, string[]> = {
    matematika: ["matematik", "fizika", "fizik", "statistika", "computer science", "kompyuter fan", "mexanika", "raqamli usul"],
    fizika: ["fizika", "fizik", "astrofizika", "mexanika", "elektr", "energetika", "radio"],
    kimyo: ["kimyo", "kimyoviy", "biokimyo", "farmasevtika", "farmatsiya"],
    biologiya: ["biologiya", "genetika", "anatomiya", "fiziologiya", "bio"],
    ingliz: ["ingliz tili", "english", "chet tili"],
  };

  /**
   * DIRECTION RELEVANCE TIERS (Fix: ranking semantics) — "AI/IT" so'raganda
   * "Data Science" bilan "Atrof-muhit muhandisligi" bir xil 40 ball olmasligi
   * kerak. Har bir topilgan yo'nalish nomi uchun moslik darajasi aniqlanadi:
   *   tier1 (core, x1.0)  — aynan so'ralgan sohaning markaziy yo'nalishlari
   *   tier2 (adjacent x0.65) — yondosh yo'nalishlar
   *   tier3 (loose x0.35)  — umumiy/generic terminlar orqali mos kelgan
   *   fallback (x0.15)     — faqat generic term bilan mos kelgan (masalan
   *                          "muhit" → "it " substringi kabi noaniq moslik)
   * Tier jadvali bo'lmagan kategoriyalar: barcha specific termlar tier1,
   * generic termlar tier3 hisoblanadi.
   */
  private readonly DIRECTION_RELEVANCE_TIERS: Record<string, { tier1: string[]; tier2: string[]; tier3: string[] }> = {
    it: {
      tier1: ["data science", "malumotlar", "suniy intellekt", "sun'iy intellekt", "artificial intelligence",
              "machine learning", "computer science", "kompyuter fan", "software", "dasturiy injiniring",
              "kompyuter injiniring", "dasturlash", "kiberxavfsizlik", "siber", "full stack", "blokcheyn",
              "axborot texnolog", "ai"],
      tier2: ["information systems", "axborot tizim", "information", "computer", "web", "mobile", "cloud",
              "raqamli", "fintech"],
      tier3: ["telekommunikatsiya", "network", "it"],
    },
    tibbiyot: {
      tier1: ["tibbiyot", "davolash", "stomatolog", "farmatsevtika", "farmatsiya", "pediatriya", "jarrohlik",
              "terapiya", "klinik", "medical", "dentistry", "xamshiralik", "hamshiralik", "sogliqni saqlash",
              "akusherlik", "ginekologiya", "kardiologiya", "neyrologiya", "onkologiya", "oftalmologiya"],
      tier2: ["biologiya", "genetika", "anatomiya", "fiziologiya", "immunologiya", "epidemiologiya",
              "sanitariya", "bio"],
      tier3: ["kimyo", "fizika"],
    },
    iqtisod: {
      tier1: ["iqtisod", "economics", "moliya", "finance", "buxgalteriya", "bank ishi", "audit", "soliq",
              "menejment", "management", "marketing", "business", "tijorat", "savdo"],
      tier2: ["logistika", "konsalting", "reklama", "startap", "tadbirkor", "investitsiya", "kredit"],
      tier3: ["statistika"],
    },
  };

  // MAJOR-DENSITY HARD FILTER qoidalari (per-kategoriya, real API tahlilidan).
  // 2026-08-05 diagnostika: 154 univ, 4889 yo'nalish. Har bir kategoriya uchun
  // "qancha ANIQ yo'nalish + qancha ulush" yetarli ekani sozlandi:
  //   it:  (3+ VA 6%) YOKI 25% — IT-fokuslilar (Amity 44%, INHA 33%, TATU 24%)
  //       o'tadi, periferiklar (transport 3%, moliya 5.9%) chiqariladi.
  //   tibbiyot: sof tibbiyot univlari 33%+ (TTA, SamDTM, BuxDTM), xalqaro
  //       tibbiyot (ZARMED 8 ta aniq, 15%) hamda kichik sof institutlar
  //       (Toshfarm 3/43%, stomatologiya 4/57%) qolishi uchun minStrong=5 +
  //       minShare=12% YOKI 40%. Periferiklar (Turon 4/13%, UBS 6/9%, Qo'qon
  //       filiali 4/29%, texnikumlar 1-2/4-5%) chiqariladi.
  //   iqtisod: ko'p univda 1-2 ta iqtisod yo'nalishi bor (101/154 o'tardi!) —
  //       minStrong=5 + minShare=15% bilan 57 taga tushirildi.
  //   pedagogika: TDPU/Qo'qon/Jizzax DPI 42%+ qoladi; 1-3 ta yo'nalishli
  //       universal (Beruniy, Qo'qon univ) chiqariladi.
  //   muhandislik: TDTU 47%, TAKU 47%, konchilik 57% qoladi; 2 ta yo'nalishli
  //       periferiklar (Koreya xalqaro, Al-Xorazmiy 20%) chiqariladi.
  private readonly MAJOR_DENSITY_RULES: Record<string, { minStrong: number; minShare: number; orShare: number }> = {
    it:          { minStrong: 3, minShare: 0.06, orShare: 0.25 },
    tibbiyot:    { minStrong: 5, minShare: 0.12, orShare: 0.40 },
    biomedical:  { minStrong: 3, minShare: 0.10, orShare: 0.30 },
    iqtisod:     { minStrong: 5, minShare: 0.15, orShare: 0.40 },
    huquq:       { minStrong: 3, minShare: 0.10, orShare: 0.30 },
    pedagogika:  { minStrong: 5, minShare: 0.15, orShare: 0.30 },
    muhandislik: { minStrong: 6, minShare: 0.20, orShare: 0.40 },
    tarix:       { minStrong: 3, minShare: 0.10, orShare: 0.25 },
    filologiya:  { minStrong: 5, minShare: 0.20, orShare: 0.40 },
    sanat:       { minStrong: 4, minShare: 0.10, orShare: 0.25 },
    sport:       { minStrong: 4, minShare: 0.10, orShare: 0.30 },
    qishloq:     { minStrong: 4, minShare: 0.15, orShare: 0.30 },
    turizm:      { minStrong: 3, minShare: 0.15, orShare: 0.30 },
  };

  /**
   * Kategoriya uchun major-density qoidasini qaytaradi (default: IT qoidasi).
   */
  private getMajorDensityRule(category: string | undefined): { minStrong: number; minShare: number; orShare: number } {
    if (category && this.MAJOR_DENSITY_RULES[category]) return this.MAJOR_DENSITY_RULES[category];
    return { minStrong: 3, minShare: 0.06, orShare: 0.25 };
  }

  /**
   * Topilgan yo'nalish nomlari bo'yicha so'ralgan kategoriyaga moslik darajasi (0-1).
   * LLM emas — backend qaror qiladi: eng yuqori tier'ga tushgan yo'nalish
   * universitetning yo'nalish ballini belgilaydi.
   */
  private computeDirectionRelevance(category: string, matchedNames: string[]): { relevance: number; tier: number; strongCount: number; density: number } {
    if (!matchedNames.length) return { relevance: 0.15, tier: 4, strongCount: 0, density: 0 };
    const tiers = this.DIRECTION_RELEVANCE_TIERS[category];
    const catTerms = this.CATEGORY_KEYWORDS[category] || [];
    // Review fix: strongCount FILTER bilan BIR XIL manbadan olinadi —
    // CATEGORY_KEYWORDS'dagi non-generic (specific) termlar. Tier jadvallari
    // faqat relevance (tier1/2/3) ni belgilaydi. Aks holda kelajakda kategoriya
    // terminiga tier jadvalida qo'shilmasa filter va scoring ajralib qolardi.
    const catStrongTerms = catTerms.filter((t) => !this.isGenericDirectionTerm(t));
    // Review fix: takrorlanuvchi variantlar ("Kompyuter injiniringi (A)" x6)
    // density'ni sun'iy oshirmasligi uchun nom bo'yicha dedup qilinadi.
    const seenNames = new Set<string>();
    let best = 0.15;
    let bestTier = 4;
    let strongCount = 0;
    for (const raw of matchedNames) {
      const name = (raw || "").toLowerCase();
      if (!name) continue;
      const dedupKey = name.replace(/\s+/g, " ").trim();
      const isFirst = !seenNames.has(dedupKey);
      seenNames.add(dedupKey);
      let t1 = false;
      let t2 = false;
      let weak = false;
      if (tiers) {
        t1 = tiers.tier1.some((term) => !this.isGenericDirectionTerm(term) && this.termMatchesDirection(name, term));
        t2 = tiers.tier2.some((term) => !this.isGenericDirectionTerm(term) && this.termMatchesDirection(name, term));
        weak = tiers.tier1.some((term) => this.isGenericDirectionTerm(term) && this.termMatchesDirection(name, term))
          || tiers.tier2.some((term) => this.isGenericDirectionTerm(term) && this.termMatchesDirection(name, term))
          || tiers.tier3.some((term) => this.termMatchesDirection(name, term));
      } else {
        // Maxsus tier jadvali yo'q — specific term → tier1, generic → weak
        t1 = catTerms.some((term) => !this.isGenericDirectionTerm(term) && this.termMatchesDirection(name, term));
        weak = catTerms.some((term) => this.isGenericDirectionTerm(term) && this.termMatchesDirection(name, term));
      }
      // DENSITY (IT chuqurligi): filter bilan bir xil specific termlar soni.
      // "TATU 20 ta IT yo'nalishi" vs "irrigatsiya institutida 2 ta" farqi.
      if (isFirst && catStrongTerms.some((term) => this.termMatchesDirection(name, term))) strongCount++;
      if (t1) {
        if (best < 1) { best = 1; bestTier = 1; }
      } else if (t2 && best < 0.65) {
        best = 0.65;
        bestTier = 2;
      } else if (weak && best < 0.35) {
        best = 0.35;
        bestTier = 3;
      }
    }
    // DENSITY: nechta ANIQ yo'nalish borligi. Kategoriya qoidasining minStrong
    // qiymatiga nisbatan normallashtiriladi (IT uchun minStrong=3, tibbiyot uchun
    // 5, iqtisod uchun 5...). minStrong+ ta = to'liq density (1). 2 ta = yarim mos.
    // 0 ta = faqat generic mos (0). Qattiq 4 o'rniga kategoriya qoidasi ishlatiladi
    // — aks holda tibbiyotda 4 ta yo'nalishli univ to'liq ball olib, iqtisodda ham
    // 4 ta yetarli bo'lib qolardi.
    const rule = this.getMajorDensityRule(category);
    const minStrong = Math.max(rule.minStrong, 1);
    const density = strongCount >= minStrong ? 1 : strongCount / minStrong;
    return { relevance: best, tier: bestTier, strongCount, density };
  }

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
  /**
   * Termin yo'nalish nomiga mos keladimi?
   * Qisqa terminlar uchun SO'Z CHEGARASI ishlatiladi — aks holda "it" termini
   * "MatemaTIKA", "GeneTIKA", "Kiberxavfsizlik" kabi so'zlarga substring
   * bo'lib tushadi. Iboralar (bo'sh joy bor) uchun substring yetarli.
   */
  private termMatchesDirection(name: string, term: string): boolean {
    if (!term || !name) return false;
    if (term.includes(' ')) return name.includes(term);
    if (term.length <= 4) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`).test(name);
    }
    return name.includes(term);
  }

  /**
   * Termin generic (umumiy) ekanligini aniqlaydi — generic term yakka o'zi
   * mos kelsa university natijaga kirmasligi kerak (false-positive filtri).
   */
  private isGenericDirectionTerm(term: string): boolean {
    return this.GENERIC_DIRECTION_TERMS.has(term.toLowerCase().trim());
  }

  private expandSearchKeyword(keyword: string): string[] {
    const lower = keyword.toLowerCase().trim();

    // MUHIM: sinonimlar modulidan foydalanamiz — "tibbiyotga", "meditsina",
    // "vrach", "shifokor" kabi kelishik/sinonim shakllar ham kategoriyaga mos keladi.
    // so'z chegarasi bilan tekshiramiz — "it" "tarjima" ichida bo'lsa ham false qaytaradi!
    const detectedCategory = detectDirectionCategory(lower);
    if (detectedCategory) {
      const terms = this.CATEGORY_KEYWORDS[detectedCategory];
      if (terms?.length) {
        console.log(`[Expand] "${keyword}" → kategoriya "${detectedCategory}" → ${terms.length} ta term`);
        // Asl kalit so'z ham qo'shiladi — aniq moslik (masalan "dasturlash")
        // kategoriya terminlariga suyultirilib ketmasligi uchun.
        return Array.from(new Set([lower, ...terms]));
      }
    }

    // Avval aniq kategoriya nomi bo'yicha tekshiramiz (fallback)
    for (const [category, terms] of Object.entries(this.CATEGORY_KEYWORDS)) {
      if (lower === category) {
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

  private getUniversityName(uni: any): string {
    return uni.full_name_uz || uni.fullNameUz || uni.full_name_en || uni.fullNameEn || "";
  }

  /**
   * Muassasa OLIY TA'LIM (universitet/institut/akademiya) ekanligini tekshiradi.
   * MUHIM (Fix: turizm): API'da texnikum/kollej/litsey ham bor (7 ta texnikum:
   * "Toshkent turizm va mehmonxona menejmenti texnikumi", 5 ta tibbiyot
   * texnikumi, EMU texnikumi). Ular OTM EMAS — "universitet" sifatida
   * tavsiyalarga kirmasligi kerak. Turizm so'rovida texnikum 75% ulush bilan
   * birinchi o'ringa chiqib, haqiqiy universitеtlarni (SamIES, Singapur
   * menejment) orqaga surardi.
   */
  private isUniversityLike(uni: any): boolean {
    if (!uni) return false;
    const name = `${uni.full_name_uz || ''} ${uni.full_name_ru || ''} ${uni.full_name_en || ''} ${uni.fullNameUz || ''} ${uni.fullNameEn || ''} ${uni.slug || ''}`.toLowerCase();
    // MUHIM: \b (word boundary) ishlatilmaydi — o'zbek qo'shimchalari tufayli
    // "texnikumi" (texnikum + -i) so'zida \btexnikum\b mos kelmaydi! Substring
    // tekshiruv ishlatiladi: texnikum/kollej/litsey/maktab nomlari OTM emas.
    // English variantlar ham tekshiriladi (college/lyceum/vocational).
    // "school" qo'shilmaydi — "Law School" kabi real OTM nomlarida uchraydi!
    return !/(texnikum|kollej|litsey|maktab|kasb[-\s]hunar|college|lyceum|vocational)/i.test(name);
  }

  private getUniversitySearchText(uni: any): string {
    return [
      uni.full_name_uz,
      uni.fullNameUz,
      uni.full_name_ru,
      uni.fullNameRu,
      uni.full_name_en,
      uni.fullNameEn,
      uni.abbr_name_uz,
      uni.abbrNameUz,
      uni.abbr_name_en,
      uni.abbrNameEn,
      uni.slug,
    ].filter(Boolean).join(" ").toLowerCase();
  }

  private getImportantWords(text: string): string[] {
    return this.normalizeSearchText(text)
      .replace(/\b(haqida|malumot|ma'lumot|info|solishtir|taqqosla|compare|qaysi|yaxshi|yaxshiroq|afzal|farqi|va|bilan|hamda|universiteti?|university|institut|oliygoh)\b/gi, " ")
      .split(/\s+/)
      .map((w) => this.normalizeSearchWord(w))
      .filter((w) => w.length > 2);
  }

  private findMentionedUniversities(message: string | undefined, universities: any[], maxResults = 6): any[] {
    if (!message?.trim() || universities.length === 0) return [];

    const msg = this.normalizeSearchText(message.toLowerCase());
    const scored = universities
      .map((u: any) => {
        const fullName = this.normalizeSearchText(this.getUniversityName(u).toLowerCase());
        const searchText = this.normalizeSearchText(this.getUniversitySearchText(u));
        const abbr = (u.abbr_name_uz || u.abbrNameUz || u.abbr_name_en || u.abbrNameEn || "").toLowerCase();
        const slugWords = String(u.slug || "").replace(/-/g, " ");
        const nameWords = this.getImportantWords(`${fullName} ${abbr} ${slugWords}`);

        let score = 0;
        const fullNameMatched = !!(fullName && msg.includes(fullName));
        if (abbr && new RegExp(`\\b${abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(msg)) score += 12;
        if (fullNameMatched) score += 20;

        const matchedWords = nameWords.filter((w) => msg.includes(w));
        score += matchedWords.length * 3;
        if (matchedWords.length >= 2) score += matchedWords.length / Math.max(nameWords.length, 1);
        if (searchText && msg.includes(searchText)) score += 10;

        return { uni: u, score, matchedWords: matchedWords.length, fullNameMatched };
      })
      .filter((item) => item.score >= 6 || item.matchedWords >= 2)
      .sort((a, b) => b.score - a.score);

    // MUHIM (Fix): ANIQ to'liq nom mos kelgan bo'lsa (fullName message ichida
    // to'liq bor), faqat o'shalarni qaytaramiz. Aks holda "Toshkent tibbiyot
    // akademiyasi" so'rovida word-match hisobi tufayli "Toshkent pediatriya
    // tibbiyot instituti" ham qo'shilib, aniq universitet o'rniga RO'YXAT
    // qaytardi. Alohida fullNameMatched flag — score chegarasi (20) o'rniga
    // aniq tekshirish: abbr(+12)+3 so'z(+9)=21 ham score'ni oshirib qo'ymasin.
    const exactMatches = scored.filter((item) => item.fullNameMatched);
    const pool = exactMatches.length > 0 ? exactMatches : scored;

    const unique = new Map<number, any>();
    for (const item of pool) {
      const id = item.uni.id;
      if (id && !unique.has(id)) unique.set(id, item.uni);
      if (unique.size >= maxResults) break;
    }

    return Array.from(unique.values());
  }

  /**
   * ENTITY-FIRST DYNAMIC FILTERING (BOSQICH 2)
   *
   * Foydalanuvchi entity'larini (degree, language, educationType, byudjet)
   * user-side dan olingan to'liq ma'lumot bilan solishtiradi.
   *
   * `uni` — normalizeUniversity dan OLDINGI yoki KEYINGI holatda ishlaydi
   * (har ikkala formatdagi degree/educationLanguage/educationType array'larini
   * va minimalTuitionFee/maximalTuitionFee ni tushunadi).
   *
   * Qoida: agar entity ko'rsatilgan bo'lsa va universitetda shu qiymat
   * TOPILMASA → false (filterlanadi). Byudjet uchun: minimal to'lov byudjetdan
   * oshsa → false, maksimal to'lov pastki chegaradan past bo'lsa → false.
   */
  /**
   * Array'dan faqat "ishlatib bo'ladigan" (null/undefined bo'lmagan) ID'larni ajratadi.
   * MUHIM: API ba'zan [{id: null}] yoki bo'sh array qaytaradi (normalizeUniversity
   * bunday elementlarni filter qiladi) — shuning uchun bo'sh/null'li array'lar
   * university'ni filter qilmasligi kerak (lenient yondashuv).
   */
  private usableIds(arr: any): number[] {
    if (!Array.isArray(arr)) return [];
    const ids: number[] = [];
    for (const x of arr) {
      const raw = typeof x === "number"
        ? x
        : (x?.id ?? x?.degree_id ?? x?.degreeId ?? x?.education_language_id ?? x?.educationLanguageId ?? x?.education_type_id ?? x?.educationTypeId);
      // API ba'zan string id qaytarishi mumkin ("1") — number'ga aylantiramiz
      const id = typeof raw === "string" ? Number(raw) : raw;
      if (typeof id === "number" && !Number.isNaN(id)) ids.push(id);
    }
    return ids;
  }

  /**
   * Kategoriya (davlat/xususiy/xalqaro) mosligini tekshiradi.
   * MUHIM (Fix): "davlat yoki xalqaro" → institutionCategories: ["3", "5"]
   * kabi BIR NECHTA kategoriya tanlanganda ularning istalganiga mos bo'lsa
   * true qaytaradi. Ilgari faqat institutionCategory (bitta qiymat) ishlatilib,
   * xalqaro univlar tashlab yuborilardi. Barcha tool'lar (searchUniversity,
   * searchTuition, recommend) shu helper orqali ishlaydi — duplikatsiya yo'q.
   */
  private matchesInstitutionCategory(catId: any, entities: IntentResult["entities"]): boolean {
    const cats = entities?.institutionCategories;
    if (Array.isArray(cats) && cats.length > 0) {
      return cats.includes(String(catId));
    }
    const single = entities?.institutionCategory;
    if (!single) return true;
    return String(catId) === single;
  }

  private matchesAdvancedFilters(uni: any, entities: IntentResult["entities"]): boolean {
    // Degree: "bachelor" → 1 (Bakalavr), "master" → 2 (Magistr), "phd" → 3 (Doktorantura), "transfer" → 4
    if (entities.degree && this.DEGREE_ID_MAP[entities.degree]) {
      const degreeIds = this.usableIds(uni.degree || uni.degrees || uni.degree_ids);
      if (degreeIds.length > 0 && !degreeIds.includes(this.DEGREE_ID_MAP[entities.degree])) {
        return false;
      }
    }

    // Language: "english" → 2, "russian" → 3, "uzbek" → 1
    if (entities.language && this.LANG_ID_MAP[entities.language]) {
      const langIds = this.usableIds(uni.educationLanguage || uni.educationLanguages || uni.education_language);
      if (langIds.length > 0 && !langIds.includes(this.LANG_ID_MAP[entities.language])) {
        return false;
      }
    }

    // Education type: "full-time" → 1, "part-time" → 2, "evening" → 3, "distance" → 4
    if (entities.educationType && this.ET_ID_MAP[entities.educationType]) {
      const etIds = this.usableIds(uni.educationType || uni.educationTypes || uni.education_type);
      if (etIds.length > 0 && !etIds.includes(this.ET_ID_MAP[entities.educationType])) {
        return false;
      }
    }

    // Byudjet: minimal to'lov yuqori chegaradan oshmasligi kerak,
    // maksimal to'lov pastki chegaradan past bo'lmasligi kerak
    const minFee = uni.minimalTuitionFee ?? uni.minimal_tuition_fee;
    const maxFee = uni.maximalTuitionFee ?? uni.maximal_tuition_fee;
    if (entities.tuitionMax !== undefined) {
      // "20 mln gacha" → minimal to'lov 20 mln dan oshsa → exclude
      if (minFee !== undefined && minFee !== null && minFee > entities.tuitionMax) return false;
      if ((minFee === undefined || minFee === null) && maxFee !== undefined && maxFee !== null && maxFee > entities.tuitionMax) {
        return false;
      }
    }
    if (entities.tuitionMin !== undefined) {
      // "15 mln dan yuqori" → maksimal to'lov 15 mln dan past bo'lsa → exclude
      if (maxFee !== undefined && maxFee !== null && maxFee < entities.tuitionMin) return false;
      if ((maxFee === undefined || maxFee === null) && minFee !== undefined && minFee !== null && minFee < entities.tuitionMin) {
        return false;
      }
    }

    return true;
  }

  /**
   * AUTH_EXPIRED ajratish (401 ≠ ma'lumot yo'q): tool xatolarida asl xabarni
   * saqlaydi. Mentalaba API 401 qaytarsa (user tokeni eskirgan + refresh ham
   * ishlamagan) external-api-patch 'AUTH_EXPIRED' markerli xato tashlaydi →
   * bu yerda error="AUTH_EXPIRED" qaytadi → provider-manager "topilmadi"
   * o'rniga LOGIN so'rovini ko'rsatadi (noto'g'ri "ma'lumot yo'q" emas).
   */
  private errorResult(tool: string, fallback: string, error?: any): ToolResult {
    const msg = error?.message || (typeof error === "string" ? error : "") || "";
    return {
      tool: tool as any,
      success: false,
      error: /AUTH_EXPIRED/i.test(msg) ? "AUTH_EXPIRED" : msg || fallback,
    };
  }

  async execute(intent: IntentResult, sessionContext?: any, userMessage?: string): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    // ===== TOOL ACCESS POLICY (BOSQICH 1 + GUEST) =====
    // Login qilmagan (guest) foydalanuvchi MENTALABA API'ga chiqadigan
    // handler'larni ishlata olmaydi — API UMUMAN chaqirilmaydi (global .env
    // tokeni ham ishlatilmaydi). API'siz handlerlar ('none' suhbat/maslahat,
    // 'list_directions' statik katalog) guest'lar uchun ochiq. Natija
    // authRequired=true → provider-manager login so'rovini ko'rsatadi.
    const API_HANDLERS = new Set([
      "search_university", "search_direction", "search_grants", "search_news",
      "search_tuition", "compare_universities", "get_admission",
      "get_transfer", "explain_recommendation",
      // MUHIM: "recommend" bloksetda EMAS — uning clarification dialogi API'siz
      // ishlaydi (guest "Universitet tanlashda menga maslahat ber" deyishi mumkin).
      // Real ma'lumot kerak bo'lganda recommend tool ichida bloklanadi.
    ]);
    const isGuest = sessionContext?.isGuest === true;
    if (isGuest) {
      const guestHandler = getIntentHandler(intent.intent);
      if (API_HANDLERS.has(guestHandler)) {
        console.log(`[ToolAccessPolicy] GUEST → "${intent.intent}" (${guestHandler}) BLOKLANDI — login talab qilinadi`);
        results.push({ tool: intent.intent as any, success: false, authRequired: true });
        return results;
      }
    }

    try {
      // BOSQICH 4 (JSON-driven config): intent → handler mapping intent-config.json dan.
      // Yangi intent qo'shishda tool-router kodiga tegish shart emas — config'da
      // mavjud handler ko'rsatish yetarli (masalan: handler: "search_university").
      const handler = getIntentHandler(intent.intent);
      const dispatchFn = this.HANDLER_DISPATCH[handler];
      if (dispatchFn) {
        results.push(await dispatchFn(intent, sessionContext, userMessage));
      } else {
        console.warn(`[ToolRouter] No handler for intent "${intent.intent}" (handler="${handler}") — returning none`);
        results.push({ tool: "none" as any, success: true });
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

  private async searchUniversity(intent: IntentResult, sessionContext?: any, userMessage?: string): Promise<ToolResult> {
    const { university, region, institutionCategory, accommodation, degree, language, educationType, tuitionMax, tuitionMin } = intent.entities;

    try {
      // MUHIM: typo tolerance — userMessage'ni BIR marta normalizatsiya qilamiz
      // ("universitei", "shaxridan", "daturchi" kabi typolar ham matching'da
      // ishlashi uchun). Keyingi barcha ishlov normalizatsiyalangan matndan oladi.
      const normalizedMessage = normalizeUserText(userMessage || '');
      userMessage = normalizedMessage;
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

      // MUHIM (Fix: turizm): texnikum/kollej/litsey OTM emas — chiqarib tashlanadi
      universitiesList = universitiesList.filter((u: any) => this.isUniversityLike(u));

      if (universitiesList.length === 0) {
        return { tool: "search_university" as any, success: true, data: [] };
      }

      const mentionedUniversities = this.findMentionedUniversities(userMessage, universitiesList, 8);
      if (mentionedUniversities.length > 1) {
        universitiesList = mentionedUniversities;
      }

      // Agar aniq universitet nomi berilgan bo'lsa, nomi bo'yicha filtrlaymiz
      if (university && mentionedUniversities.length <= 1) {
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
            // BOSQICH 11: ko'rsatilgan universitеtni session'ga yozamiz
            // ("PDP chi? → uning narxlari qancha?" zanjiri uchun)
            this.rememberUniversity(sessionContext, fullDetail);
            return { tool: "search_university" as any, success: true, data: this.normalizeUniversity(fullDetail) };
          }
        } catch { /* user-side ishlamasa, filter ma'lumotini ishlat */ }
        
        // AGAR user-side API ishlamasa, filterdagi basic ma'lumot bilan qaytaramiz
        // Bu MUHIM: "Turin Politexnika universiteti haqida" desa, 1 ta natija topilgan,
        // keyin user-side timeout bo'lsa, "### 🏛 Universitetlar ro'yxati" (LIST) emas,
        // balki single-uni format chiqishi kerak!
        const basicUni = universitiesList[0];
        this.rememberUniversity(sessionContext, basicUni);
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

      // Kategoriya/region/degree/language/byudjet bo'yicha filtrlash — user-side/{id} orqali to'liq ma'lumot olamiz
      // MUHIM (BOSQICH 2): endi degree, language, educationType, byudjet va yotoqxona ham
      // user-side enrichment'ni trigger qiladi — aks holda bu entity'lar e'tiborsiz qolardi!
      const needsDetailFilter = institutionCategory || targetRegionName || accommodation || degree || language || educationType || tuitionMax !== undefined || tuitionMin !== undefined;
      if (needsDetailFilter && universitiesList.length > 0) {
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
            // Kategoriya bo'yicha tekshirish (Fix): "davlat yoki xalqaro"
            // kombinatsiyalari ham ishlashi uchun helper ishlatiladi.
            const catMatch = this.matchesInstitutionCategory(uni.institution_category_id, intent.entities);
            // Hudud bo'yicha tekshirish — asosiy shahar nomini solishtiramiz
            // Masalan: "Samarqand shahri" va "Samarqand viloyati" ikkalasi "samarqand" ga mos keladi
            const getBaseCity = (s: string) => s.replace(/ (viloyati|shahri|respublikasi)$/i, '').trim();
            const locLower = (uni.location_uz || '').toLowerCase();
            const locBase = getBaseCity(locLower);
            const targetBase = getBaseCity(targetRegionName || '');
            const locationMatch = !targetRegionName || locBase === targetBase || locLower.includes(targetRegionName);
            // Yotoqxona bo'yicha tekshirish — agar so'ralgan bo'lsa
            const accommodationMatch = !accommodation || uni.has_accomodation === true || uni.hasAccommodation === true;
            // BOSQICH 2: degree/language/educationType/byudjet entity'lari bilan filterlash
            const advancedMatch = this.matchesAdvancedFilters(uni, intent.entities);
            if (catMatch && locationMatch && accommodationMatch && advancedMatch) {
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
              this.rememberUniversity(sessionContext, fullDetail);
              return { tool: "search_university" as any, success: true, data: this.normalizeUniversity(fullDetail) };
            }
          } catch { /* user-side ishlamasa, filter natijasini ishlat */ }
        }

        if (mentionedUniversities.length > 1) {
          const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
          const details = await Promise.allSettled(
            universitiesList.slice(0, 8).map((u: any) =>
              Promise.race([externalApi.getUniversityUserSide(u.id), timeout(5000)])
            )
          );

          finalList = details
            .filter((r) => r.status === 'fulfilled' && (r as any).value?.id)
            .map((r: any) => this.normalizeUniversity(r.value));
        }

        if (finalList.length === 0) {
          finalList = universitiesList.slice(0, 20).map((u: any) => ({
            id: u.id,
            slug: u.slug,
            fullNameUz: u.full_name_uz || '',
            fullNameEn: u.full_name_en || '',
            location: u.location_uz || '',
            institutionCategory: u.institution_category_id
              ? lookupManager.getCategoryName(u.institution_category_id, 'uz')
              : '',
          }));
        }
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

          // BOSQICH 11: ro'yxat ko'rsatilganda ham birinchi universitеtni eslab
          // qolamiz — keyingi "uning narxi qancha?" so'rovi ro'yxatdagi
          // birinchi univga bog'lanadi (lastUniversity > lastDirection).
          if (finalList && finalList.length > 0) this.rememberUniversity(sessionContext, finalList[0]);

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

      if (finalList && finalList.length > 0) this.rememberUniversity(sessionContext, finalList[0]);

      return {
        tool: "search_university" as any,
        success: true,
        data: finalList,
      };
    } catch (error: any) {
      console.warn("[University Search Error]", error?.message);
      return this.errorResult("search_university", "Universitet ma'lumotlarini olishda xatolik", error);
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
  /**
   * RESULT VALIDATOR (BOSQICH 14) — searchDirection natijasini moslik bo'yicha cheklaydi.
   *
   * User "tibbiyot/davolash ishi" so'raganda natijada IT univlar (TATU) yoki
   * faqat 1-2 ta yondosh yo'nalishi bor univlar chiqib ketmasligi uchun:
   * har bir mos universitetning "qancha ANIQ yo'nalishi" so'ralgan kategoriyaga
   * mos kelishini hisoblab, MAJOR-DENSITY qoidasiga (recommend'dagi bilan bir xil)
   * mos kelmaydiganlarni chiqarib tashlaydi.
   *
   * Qoida (per-kategoriya, MAJOR_DENSITY_RULES):
   *   (minStrong+ aniq yo'nalish VA minShare+ ulush) YOKI orShare+ ulush.
   * Barchasi chiqib ketsa — relaxed fallback: kamida minStrong aniq yo'nalishi
   * bor univlar qoladi ("topilmadi" o'rniga haqiqiy variantlar).
   *
   * @returns filterdan o'tgan univ id'lari (jamlanma soni bilan)
   */
  private validateDirectionResults(
    candidateIds: number[],
    matches: any[],
    directionCategory: string | undefined,
    totalDirsByUni?: Map<number, number>
  ): { ids: number[]; total: number } {
    if (!directionCategory || candidateIds.length === 0) {
      return { ids: candidateIds, total: candidateIds.length };
    }

    // Har bir mos univ uchun ANIQ (specific) yo'nalishlar soni
    const strongByUni = new Map<number, number>();
    const seen = new Set<string>();
    for (const m of matches as any[]) {
      if (!candidateIds.includes(m.universityId)) continue;
      if (m.matchStrong) {
        const key = `${m.universityId}:${(m.nameUz || m.nameEn || '').toLowerCase().replace(/\s+/g, ' ').trim()}`;
        if (!seen.has(key)) {
          seen.add(key);
          strongByUni.set(m.universityId, (strongByUni.get(m.universityId) || 0) + 1);
        }
      }
    }

    const rule = this.getMajorDensityRule(directionCategory);
    const passing: number[] = [];
    const relaxed: number[] = [];
    for (const id of candidateIds) {
      const strongCount = strongByUni.get(id) || 0;
      if (strongCount < 1) {
        console.log(`[Validator] Univ #${id} chiqarildi — 0 ta aniq "${directionCategory}" yo'nalishi`);
        continue;
      }
      // MUHIM: ulush REAL jami yo'nalishlar soniga nisbatan hisoblanadi
      // (batch'da yig'ilgan totalDirsByUni). Mos yo'nalishlar soniga emas —
      // aks holda 2 ta mos kelgan biologiya/kimyo univi 100% bo'lib qolardi!
      // REVIEWER FIX: real total NO'L (API timeout) bo'lsa || strongCount ga
      // tushib 100% bo'lib qolmasin — undefined/0 bo'lsa konservativ: strongCount
      // (faqat moslar) emas, ulushni to'liq ishonchsiz deb qoldirib strongCount
      // bilan tekshiramiz (share=100% o'rniga minStrong qoidasi ishlaydi).
      const rawTotal = totalDirsByUni?.get(id);
      const total = rawTotal !== undefined && rawTotal > 0 ? rawTotal : strongCount;
      const share = strongCount / Math.max(total, 1);
      const passesMajor = (strongCount >= rule.minStrong && share >= rule.minShare) || share >= rule.orShare;
      console.log(`[Validator] Univ #${id}: ${strongCount}/${total} aniq (ulush ${Math.round(share * 100)}%) → ${passesMajor ? "O'TDI" : "chiqarildi"}`);
      if (passesMajor) {
        passing.push(id);
      } else if (strongCount >= rule.minStrong) {
        relaxed.push(id);
      }
    }

    // HAMMASI chiqib ketsa — relaxed (minStrong yetganlar) qoladi
    if (passing.length === 0 && relaxed.length > 0) {
      console.log(`[Validator] Fallback: minShare yumshatildi — ${relaxed.length} ta univ (minStrong=${rule.minStrong} yetdi)`);
      return { ids: relaxed, total: relaxed.length };
    }
    return { ids: passing, total: passing.length };
  }

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

      // MUHIM (Fix: turizm): texnikum/kollej/litsey OTM emas — chiqarib tashlanadi
      universities = universities.filter((u: any) => this.isUniversityLike(u));

      if (universities.length === 0) {
        return { tool: "search_direction" as any, success: true, data: { directions: [], universities: [] } };
      }

      // 1.5. AGAR foydalanuvchi ma'lum bir universitet nomini aytgan bo'lsa — 
      // shu universitetning YO'NALISHLARINI to'g'ridan-to'g'ri olamiz
      // "Samarqand davlat universitetida qanday yo'nalishlar bor?
      // MUHIM: normalizeUserText BIR marta — typo tolerance ("universitei",
      // "daturchi"...) ham uni-matching, ham keyword extraction'da ishlashi uchun.
      const normalizedUserMessage = normalizeUserText(userMessage || '');
      const userMessageLower = normalizedUserMessage;
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
            },
          };
        }
      }

      // 2. Foydalanuvchi matnidan kalit so'zni ajratib olish
      // MUHIM: normalizedUserMessage (1.5 qadamda tayyorlangan) ishlatiladi —
      // klassifikator ham shu normalizatsiyani ishlatadi, aks holda
      // "daturchi bolmoqchiman" classifier'da dasturchi (IT) bo'ladi, lekin tool
      // "daturchi" bilan qidirib bo'sh natija qaytaradi!
      let searchKeyword = '';
      if (normalizedUserMessage) {
        const cleaned = normalizedUserMessage
          .replace(/\b(bilsan?mi|men|ga|ni|ning|da|dan|bilan|uchun|kerak|bor|haqida|qiziqaman|qiziqasiz|qiziqadi|qarayman|izlayman|top|ayt|ber|ko'rsat|universitet|universitetni|tavsiya|maslahat|bering|bersan(gizmi)?|bermoqchi)\b/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (cleaned.length > 1) {
          searchKeyword = cleaned;
        }
      }

      // STAGE 14 — EXACT DIRECTION RESOLUTION:
      // "davolash ishiga" kabi ANIQ yo'nalish so'rovi "tibbiyot" kategoriyasi
      // sifatida kengaytirilmasligi kerak (RULE 1). Foydalanuvchi xabari (asl,
      // follow-up konteksti qo'shilgan emas) ichidan aniq nom ajratib olinadi.
      // "tibbiyotga qiziqaman" → exact=null (kategoriya), "davolash ishiga" →
      // exact="davolash ishi". exact bo'lsa FAQAT shu nomdagi yo'nalishlar
      // qidiriladi (farmatsiya/pediatriya qo'shilmaydi — RULE 3).
      const exactDirection = detectExactDirection(userMessage || '');
      if (exactDirection) {
        console.log(`[ExactDirection] "${exactDirection}" aniq yo'nalish — kategoriya kengaytirilmaydi`);
        // Aniq nom kalit so'zga aylanadi (kategoriya terminlari emas)
        searchKeyword = exactDirection;
      }

      // 2.5 MUHIM GUARD: kalit so'z ham, aniq universitet ham bo'lmasa —
      // 60 ta API call qilib bo'sh natija qaytarish o'rniga DARHOL bo'sh qaytaramiz.
      // "qanday yo'nalishlar mavjud" kabi katalog so'rovlar endi direction_list
      // intentiga (listDirections tooliga) tushadi — bu yerda hech qachon bo'sh
      // query bilan search qilinmaydi.
      if (!searchKeyword && !matchedUni) {
        console.log(`[Guard] search_direction empty keyword & no university → catalog expected, returning empty`);
        return {
          tool: "search_direction" as any,
          success: true,
          data: { directions: [], universities: [], universityDirections: undefined },
        };
      }

      // BOSQICH 3 (Context Manager): region bo'yicha pre-filter
      // Follow-up zanjiri natijasida: "Toshkent it davlatlari" → region=14 + category=3
      // Shunda faqat o'sha hududdagi universitetlarning yo'nalishlari olinadi.
      //
      // MUHIM (Fix): kategoriya (davlat/xususiy/xalqaro) BU YERDA filterlanmaydi!
      // /universities/filter endpoint institution_category_id QAYTARMAYDI (faqat
      // id+name+basic fields), shuning uchun `u.institution_category_id?.toString()
      // !== dirCategory` tekshiruvi HAMMA universitetlarni o'chirib yuborardi
      // (undefined !== "3" → true → bo'sh natija). Kategoriya faqat user-side/{id}
      // endpoint orqali aniq bo'ladi — keyingi bosqichda (5) tekshiriladi.
      const dirRegion = intent.entities?.region;
      if (dirRegion) {
        const targetRegion = lookupManager.getRegionName(parseInt(dirRegion), 'uz').toLowerCase();
        const shortRegion = targetRegion
          ? targetRegion.replace(' viloyati', '').replace(' shahri', '').replace(' respublikasi', '').trim()
          : null;
        if (shortRegion) {
          universities = universities.filter((u: any) => {
            const name = `${u.full_name_uz || ''} ${u.full_name_ru || ''} ${u.full_name_en || ''}`.toLowerCase();
            return name.includes(shortRegion);
          });
          console.log(`[Direction] Region pre-filter: ${universities.length} ta qoldi`);
        }
      }

      // 3. Har bir universitet uchun yo'nalishlarni olish (parallel, cheklangan, timeout bilan)
      // MUHIM (Fix 9): BATCH LOOP — /universities/filter ro'yxatida davlat
      // universitetlari 90-140 o'rinlarda keladi (birinchi 60 tasi asosan xususiy/
      // xalqaro). Ilgari 2-bosqich faqat 1-bosqichda < 8 ta mos topilganda ishga
      // tushardi → "Davlat X yo'nalishlari" da 1-bosqich xususiy/xalqaro univlarning
      // yo'nalishlari 8+ mos bersa, davlat univlari (90-140) HECh qachon tekshirilmasdi
      // → kategoriya filtri 0 ta → bo'sh natija. Endi: kategoriya sharti bo'lsa,
      // HAR batch'dan keyin kategoriya filtri ishlaydi va 8 ta kategoriyaga mos univ
      // topilguncha keyingi batch'lar davom etadi.
      const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
      const BATCH_SIZE = 60;
      const dirCategory = intent.entities?.institutionCategory;

      // 4. Kalit so'zni KENGAYTIRIB, barcha aloqador terminlar bo'yicha mos yo'nalishlarni topish
      // "tibbiyot" desa → tibbiyot, stomatolog, farmatsevtika, davolash, pediatriya...
      // "IT" desa → sun'iy intellekt, dasturlash, kiberxavfsizlik, kompyuter fan...
      // STAGE 14 (RULE 1): EXACT direction bo'lsa — kengaytirilmaydi, faqat shu
      // nom bilan taqqoslanadi ("davolash ishi" → faqat "davolash ishi",
      // farmatsiya/pediatriya qo'shilmaydi).
      const exactMode = exactDirection !== null;
      const expandedTerms = exactMode
        ? [normalizeDirectionName(exactDirection)]
        : searchKeyword ? this.expandSearchKeyword(searchKeyword) : [];

      const matches: any[] = [];
      const userSideCache = new Map<number, any>();
      const catMatched: number[] = [];
      // RESULT VALIDATOR (BOSQICH 14): har univning REAL jami yo'nalishlar soni
      // (ulush hisoblash uchun — "TTA 6/30 ta tibbiyot" vs "TATU 1/40 ta").
      const totalDirsByUni = new Map<number, number>();

      // Ko'rsatiladigan universitetlar soni (shu son topilsa batch'lar to'xtaydi)
      const TARGET_SHOW = 8;

      const collectMatches = (results: PromiseSettledResult<any>[]) => {
        for (const r of results) {
          if (r.status === 'fulfilled') {
            const { universityId, universityName, universitySlug, dirs } = (r as any).value;
            for (const d of dirs) {
              const nameUz = (d.name_uz || '').toLowerCase();
              const nameEn = (d.name_en || '').toLowerCase();
              // MUHIM (Fix: search aniqlik):
              // 1) word-boundary matching ("it" "Matematika" ichiga tushmaydi)
              // 2) specific term generic'dan ustun — birinchi specific mos
              //    ishlatiladi, specific topilmasa birinchi generic mos.
              // 3) matchStrong flag false-positive filtr uchun saqlanadi.
              let usedTerm = '';
              let matchStrong = false;
              for (const term of expandedTerms) {
                if (this.termMatchesDirection(nameUz, term) || this.termMatchesDirection(nameEn, term)) {
                  if (!this.isGenericDirectionTerm(term)) {
                    usedTerm = term;
                    matchStrong = true;
                    break;
                  }
                  if (!usedTerm) usedTerm = term;
                }
              }
              if (usedTerm) {
                // STAGE 14 (RULE 3): exact rejimda faqat NOMI AYNAN shu yo'nalish
                // bo'lgan matchlar qabul qilinadi (substring match ham, lekin
                // boshqa nomlar — farmatsiya — kirmaydi).
                if (exactMode) {
                  const normUz = normalizeDirectionName(nameUz);
                  const normEn = normalizeDirectionName(nameEn);
                  const isExact = normUz === expandedTerms[0] || normEn === expandedTerms[0];
                  if (!isExact) continue;
                }
                matches.push({
                  id: d.id,
                  nameUz: d.name_uz,
                  nameEn: d.name_en,
                  universityId,
                  universityName,
                  universitySlug,
                  matchStrong,
                });
              }
            }
          }
        }
      };

      // Bir batch universitetlar uchun yo'nalishlarni parallel olish
      const fetchDirectionsFor = async (uniList: any[]) => {
        const results = await Promise.allSettled(
          uniList.map((u: any) =>
            Promise.race([externalApi.getDirectionsByUniversity(u.id), timeout(4000)]).then((dirs: any) => ({
              universityId: u.id,
              universityName: u.full_name_uz || u.fullNameUz || '',
              universitySlug: u.slug || '',
              dirs: Array.isArray(dirs) ? dirs : [],
            }))
          )
        );
        // Validator uchun REAL jami yo'nalishlar sonini saqlaymiz
        for (const r of results) {
          if (r.status === 'fulfilled' && (r as any).value) {
            const v = (r as any).value;
            if (!totalDirsByUni.has(v.universityId)) {
              totalDirsByUni.set(v.universityId, Array.isArray(v.dirs) ? v.dirs.length : 0);
            }
          }
        }
        collectMatches(results);
      };

      // Kategoriya tekshiruvi (user-side/{id} orqali, chunk'lab) — berilgan id'lar
      // orasidan kategoriyaga moslarini topadi. TARGET_SHOW ta topilsa to'xtaydi.
      const checkCategoryFor = async (ids: number[]) => {
        // Avval shuffle — doim bir xil birinchi N ta tekshirilmasin
        const shuffled = [...ids];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const CAT_CHECK_CHUNK = 10;
        for (let i = 0; i < shuffled.length; i += CAT_CHECK_CHUNK) {
          const chunk = shuffled.slice(i, i + CAT_CHECK_CHUNK);
          const catChecks = await Promise.allSettled(
            chunk.map((id: any) =>
              Promise.race([externalApi.getUniversityUserSide(id), timeout(4000)])
            )
          );
          for (const r of catChecks) {
            if (r.status === 'fulfilled' && r.value?.id) {
              userSideCache.set(r.value.id, r.value);
              // Fix: "davlat yoki xalqaro" kombinatsiyalari ham ishlaydi
              if (this.matchesInstitutionCategory(r.value.institution_category_id, intent.entities) && !catMatched.includes(r.value.id)) {
                catMatched.push(r.value.id);
              }
            }
          }
          // Ko'rsatish uchun TARGET_SHOW ta yetarli bo'lsa — keyingi chunk'lar kerak emas
          if (catMatched.length >= TARGET_SHOW) break;
        }
      };

      // BATCH LOOP: har batch (0-60, 60-120, 120-153) uchun yo'nalishlarni olib,
      // (agar kategoriya sharti bo'lsa) kategoriya filtrini qo'llaymiz. Kategoriya
      // bo'lmasa — eski mantiq: TARGET_SHOW ta mos univ topilsa to'xtaymiz.
      const checkedCategoryIds = new Set<number>();
      for (let start = 0; start < universities.length; start += BATCH_SIZE) {
        const batch = universities.slice(start, start + BATCH_SIZE);
        if (batch.length === 0) break;

        await fetchDirectionsFor(batch);

        // Shu paytgacha mos kelgan univ id'lari
        const matchedIdsSoFar = Array.from(new Set(matches.map((m: any) => m.universityId)));
        if (dirCategory) {
          // Kategoriya bo'lsa: bu batch'da yangi topilgan univlar uchun kategoriya tekshiruvi
          const newIds = matchedIdsSoFar.filter((id: any) => !checkedCategoryIds.has(id));
          for (const id of newIds) checkedCategoryIds.add(id);
          if (newIds.length > 0) {
            await checkCategoryFor(newIds as number[]);
            console.log(`[Direction] Batch ${start}-${start + batch.length}: kategoriya bo'yicha ${catMatched.length} ta mos`);
          }
          if (catMatched.length >= TARGET_SHOW) break;
        } else {
          if (matchedIdsSoFar.length >= TARGET_SHOW) break;
        }
      }

      // 4.5 FALSE-POSITIVE FILTER (Fix: search aniqlik):
      // FAQAT generic term bilan 1 marta mos kelgan universitetlar natijaga
      // kirmaydi. Masalan: "information" → "Health Informatics" (TTA),
      // "computer" → "Computer Graphics" (dizayn). Talab: KAMIDA 1 ta
      // specific moslik YOKI 2+ ta generic moslik.
      const uniStrong = new Map<number, number>();
      const uniWeak = new Map<number, number>();
      for (const m of matches as any[]) {
        const map = m.matchStrong ? uniStrong : uniWeak;
        map.set(m.universityId, (map.get(m.universityId) || 0) + 1);
      }
      const qualifiedUniIds = new Set<number>();
      for (const m of matches as any[]) {
        if (!qualifiedUniIds.has(m.universityId)) {
          const s = uniStrong.get(m.universityId) || 0;
          const w = uniWeak.get(m.universityId) || 0;
          if (s >= 1 || w >= 2) qualifiedUniIds.add(m.universityId);
        }
      }
      const allMatchedUniIdsRaw = Array.from(new Set(matches.map((m) => m.universityId)));
      const removedUniCount = allMatchedUniIdsRaw.length - qualifiedUniIds.size;
      if (removedUniCount > 0) {
        console.log(`[Direction] False-positive filter: ${removedUniCount} ta univ chiqarildi (faqat generic term mos edi)`);
      }

      // 5. Mos universitetlarning to'liq ma'lumotini olish
      // MUHIM (fix): ilgari faqat birinchi 5 ta mos universitet olib, ko'rsatilardi
      // (doim bir xil — Acharya birinchi). Endi BARCHA mos universitetlarni yig'ib,
      // random (Fisher-Yates shuffle) tartibda aralashtiramiz va ko'pi bilan 8 tasini
      // boyitamiz. Natijada har so'rovda boshqa universitetlar birinchi chiqadi va
      // ko'proq variant ko'rinadi. Jami son ham qaytariladi (totalMatches).
      const allMatchedUniIds = Array.from(new Set(
        matches.filter((m: any) => qualifiedUniIds.has(m.universityId)).map((m) => m.universityId)
      ));
      let totalMatches = allMatchedUniIds.length;

      // KATEGORIYA FILTRI natijasi: dirCategory bo'lsa — faqat kategoriyaga mos
      // univlar qoladi (catMatched), aks holda barcha mos univlar.
      // MUHIM (Fix 7): user-side tekshiruv chunk'lab bajarildi (har chunk'da 10 ta,
      // 8 ta topilsa to'xtaydi) — parallel overload va rate-limit oldini olish uchun.
      let candidateIds: number[] = allMatchedUniIds as number[];
      if (dirCategory) {
        candidateIds = catMatched.filter((id: any) => qualifiedUniIds.has(id));
        totalMatches = candidateIds.length;
        console.log(`[Direction] Category filter (user-side, chunked): ${catMatched.length} ta → false-positive'dan keyin ${candidateIds.length} ta`);
      }

      // RESULT VALIDATOR (BOSQICH 14): yo'nalish kategoriyasi aniq bo'lsa,
      // natijadagi IRRELEVANT universitetlarni kesamiz — "doktor bo'lishni
      // orzu qilaman" (tibbiyot) so'rovida faqat 1-2 ta yondosh yo'nalishi
      // bor IT univlar (TATU kabi) chiqib ketmasligi uchun. Major-density
      // qoidasi recommend'dagi bilan bir xil — natijalar izchil bo'ladi.
      const searchCategory = searchKeyword ? detectDirectionCategory(searchKeyword) : undefined;
      // STAGE 14 (RULE 3): exact rejimda validator o'tkazib yuboriladi — matnning
      // o'zi allaqachon ANIQ moslikni ta'minlagan ("Davolash ishi" nomi bilan
      // farmatsiya kirmaydi). Validator (major-density %) boshqa yo'nalishlarni
      // aralashtirganda kerak — exact'da emas.
      if (!exactMode && searchCategory && candidateIds.length > 0) {
        const validated = this.validateDirectionResults(candidateIds, matches, searchCategory, totalDirsByUni);
        console.log(`[Validator] "${searchCategory}": ${candidateIds.length} ta → ${validated.ids.length} ta mos`);
        candidateIds = validated.ids;
        totalMatches = validated.total;
      } else if (exactMode) {
        console.log(`[ExactDirection] Validator o'tkazib yuborildi (exact match)`);
      }

      // DIRECTION DETAIL (BOSQICH 14 — Query Resolver): user yo'nalishning O'ZI
      // haqida so'ragan bo'lsa ("davolash ishi haqida ko'proq ma'lumot"),
      // formatter yo'nalish detail rejimida javob beradi — "Sizga mos
      // universitetlar" reklamasi emas, balki yo'nalishning o'zi + qayerlarda
      // borligi ko'rsatiladi.
      const directionDetailOnly = this.queryDetailOnly(intent);

      const MAX_SHOW_UNIS = 8;

      // MUHIM (Fix 10): advanced filter (language/degree/educationType/byudjet)
      // bo'lsa, FAQAT shuffle bilan tanlangan 8 ta univ ustida emas, BARCHA
      // candidate'lar ustida tekshirish kerak — aks holda "Toshkentdagi ingliz
      // tilidagi IT yo'nalishlari" da 8 ta ichida ingliz tili yo'qlari ko'p bo'lsa,
      // bo'sh natija chiqadi (holbuki boshqa match'larda ingliz tili bor!).
      // Filterdan keyin mos qolganlardan 8 tasini tanlaymiz.
      const ent = intent.entities || {};
      const hasAdvancedFilters = !!(ent.language || ent.degree || ent.educationType ||
        ent.tuitionMax !== undefined || ent.tuitionMin !== undefined);

      let selectedUniIds: number[];
      if (hasAdvancedFilters) {
        // Barcha candidate'lar uchun user-side ma'lumotni chunk'lab olamiz
        const allNeed = candidateIds.filter((id: any) => !userSideCache.has(id));
        const CAT_FETCH_CHUNK = 10;
        for (let i = 0; i < allNeed.length; i += CAT_FETCH_CHUNK) {
          const chunk = allNeed.slice(i, i + CAT_FETCH_CHUNK);
          const chunkRes = await Promise.allSettled(
            chunk.map((id: any) =>
              Promise.race([externalApi.getUniversityUserSide(id), timeout(4000)])
            )
          );
          for (const r of chunkRes) {
            if (r.status === 'fulfilled' && (r as any).value?.id) {
              userSideCache.set((r as any).value.id, (r as any).value);
            }
          }
        }

        // Advanced filterga mos qolganlar (BARCHA candidate'lar ichidan)
        const passingIds = candidateIds.filter((id: any) => {
          const u = userSideCache.get(id);
          return u?.id && this.matchesAdvancedFilters(u, intent.entities);
        });
        totalMatches = passingIds.length;
        console.log(`[Direction] Advanced filter: ${candidateIds.length} ta → ${passingIds.length} ta mos`);

        // Mos qolganlardan 8 tasini random tanlaymiz
        const shuffledPassing = [...passingIds];
        for (let i = shuffledPassing.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledPassing[i], shuffledPassing[j]] = [shuffledPassing[j], shuffledPassing[i]];
        }
        selectedUniIds = shuffledPassing.slice(0, MAX_SHOW_UNIS);
      } else {
        const shuffledIds = [...candidateIds];
        for (let i = shuffledIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledIds[i], shuffledIds[j]] = [shuffledIds[j], shuffledIds[i]];
        }
        selectedUniIds = shuffledIds.slice(0, MAX_SHOW_UNIS);
      }

      // Kategoriya/advanced tekshiruvda user-side natijalari olinmagan bo'lsa,
      // qayta chaqirmaymiz (cache ishlatiladi) — API yukini kamaytiradi.
      const needFetch = selectedUniIds.filter((id: any) => !userSideCache.has(id));
      const freshDetails = needFetch.length > 0
        ? await Promise.allSettled(
            needFetch.map((id: any) =>
              Promise.race([externalApi.getUniversityUserSide(id), timeout(4000)])
            )
          )
        : [];
      for (const r of freshDetails) {
        if (r.status === 'fulfilled' && (r as any).value?.id) {
          userSideCache.set((r as any).value.id, (r as any).value);
        }
      }

      const enrichedUniversities = selectedUniIds
        .map((id: any) => userSideCache.get(id))
        .filter((u: any) => u?.id)
        .map((u: any) => this.normalizeUniversity(u));

      // Ko'rsatilayotgan universitetlarga oid yo'nalishlar (shuffle bilan mos keladi)
      // Agar advanced filter ba'zi universitetlarni chiqarib yuborgan bo'lsa,
      // ularning yo'nalishlari ham ko'rsatilmaydi (ichki konsistensiya).
      const enrichedUniIds = new Set(enrichedUniversities.map((u: any) => u.id));
      const shownMatches = matches
        .filter((m: any) => qualifiedUniIds.has(m.universityId) && enrichedUniIds.has(m.universityId));

      // GUARD (review): agar advanced filter (language/degree/byudjet) BARCHA
      // tanlangan universitetlarni chiqarib yuborgan bo'lsa, totalMatches ham 0
      // bo'lsin — aks holda "N ta topildi" deyilib, "topilmadi" javobi chiqadi
      // (qarama-qarshilik).
      if (enrichedUniversities.length === 0) {
        totalMatches = 0;
      }

      // MUHIM: search_direction endi KONTRAKT narxini QAYTARMAYDI!
      // Kontrakt narxlari alohida search_tuition tooliga o'tkazildi.
      // Sababi: "qanday yo'nalishlar mavjud" degan katalog so'rovda kontrakt
      // narxi IRRELEVANT edi (user buni so'ramagan). Faqat "eng arzon",
      // "narxi qancha" kabi so'rovlarda search_tuition chaqiriladi.
      //
      // RECOMMENDATION MEMORY (Fix): search_direction ham ko'rsatgan
      // universitetlarini lastRecommendations'ga yozadi. Sababi: "EMU
      // universiteti — eng mos tavsiya" javobidan keyin "menga batafsil
      // ma'lumot bera olasanmi?" so'rovida oxirgi ko'rsatilgan universitеtga
      // bog'lanish kerak (ustuvorlik: lastUniversity > lastDirection).
      // Avval faqat recommend tool yozardi — search_direction'da memory bo'lmasa
      // follow-up eski direction category'ga ("tibbiyot") tushib, noto'g'ri
      // universitеt (Qoraqalpog'iston tibbiyot instituti) chiqardi.
      if (sessionContext && enrichedUniversities.length > 0) {
        sessionContext.lastRecommendations = enrichedUniversities.slice(0, 5).map((u: any) => ({
          id: u.id,
          name: u.fullNameUz || u.fullNameEn || "",
          slug: u.slug || undefined,
        }));
        // BOSQICH 11: birinchi tavsiya qilingan universitеtni ham alohida eslab
        // qolamiz — "uning narxlari qancha?" follow-up'i oxirgi tavsiyaga
        // bog'lanadi (lastUniversity > lastRecommendations > lastDirection).
        this.rememberUniversity(sessionContext, enrichedUniversities[0]);
      }

      // BOSQICH 14 — LAST DIRECTION MEMORY: oxirgi muhokama qilingan yo'nalishni
      // eslab qolamiz ("Tibbiyotga qiziqaman → davolash ishi-chi? → qayerlarda
      // bor?"). Keyingi follow-up so'rovlar shu yo'nalishga bog'lanadi.
      // REVIEWER FIX: kategoriyaga map bo'lmagan aniq yo'nalishlar ham
      // (intent.entities.direction) eslab qolinadi.
      // STAGE 14: exact rejimda ANIQ NOM saqlanadi ("davolash ishi"),
      // kategoriya rejimida kategoriya ("tibbiyot").
      const lastDirName = exactDirection || searchCategory || intent.entities?.direction;
      if (sessionContext && lastDirName) {
        sessionContext.lastDirection = {
          name: lastDirName,
          category: searchCategory || lastDirName,
        };
        console.log(`[Direction] lastDirection → "${lastDirName}"`);
      }

      const dirPhrase =
        (intent.entities?.directionPhrase as string | undefined) ||
        exactDirection ||
        (searchCategory ? this.directionCategoryLabel(searchCategory) : undefined);

      return {
        tool: "search_direction" as any,
        success: true,
        data: {
          directions: shownMatches.slice(0, 15),
          universities: enrichedUniversities,
          universityDirections: undefined,
          totalMatches,
          // QUERY RESOLVER (BOSQICH 14): detail rejimda formatter yo'nalishning
          // o'zi haqida javob beradi, universitetlar reklamasi emas.
          directionDetail: directionDetailOnly || undefined,
          directionPhrase: directionDetailOnly ? dirPhrase : undefined,
          directionCategory: searchCategory,
          // STAGE 14: aniq yo'nalish nomi ("davolash ishi") — formatter sarlavha
          // sifatida ishlatadi ("🎓 Davolash ishi yo'nalishi").
          exactDirection: exactDirection || undefined,
        },
      };
    } catch (error) {
      return this.errorResult("search_direction", "Yo'nalish ma'lumotlarini olishda xatolik", error);
    }
  }

  /** Yo'nalish kategoriya nomi → o'zbekcha label (formatter va lastDirection uchun) */
  private directionCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      it: "IT", tibbiyot: "Tibbiyot", biomedical: "Biotibbiyot / Biomedical",
      iqtisod: "Iqtisod va moliya", huquq: "Huquq", pedagogika: "Pedagogika",
      muhandislik: "Muhandislik", filologiya: "Filologiya (tillar)",
      sanat: "San'at", sport: "Sport", qishloq: "Qishloq xo'jaligi",
      turizm: "Turizm", tarix: "Tarix",
    };
    return labels[category] || category;
  }

  /**
   * KATALOG TOOL — "qanday yo'nalishlar mavjud" degan katalog so'rovlar uchun.
   *
   * Search EMAS: hech qanday API chaqiruv qilmaydi, faqat ma'lum kategoriyalar
   * ro'yxatini qaytaradi. Foydalanuvchi keyin qaysi kategoriya qiziqtirishini
   * aytadi → shunda direction_search ishga tushadi.
   */
  private async listDirections(): Promise<ToolResult> {
    const categoryLabels: Record<string, { label: string; icon: string }> = {
      it: { label: "IT va dasturlash", icon: "💻" },
      tibbiyot: { label: "Tibbiyot", icon: "🏥" },
      iqtisod: { label: "Iqtisod va moliya", icon: "💰" },
      huquq: { label: "Huquq", icon: "⚖️" },
      pedagogika: { label: "Pedagogika", icon: "📚" },
      muhandislik: { label: "Muhandislik", icon: "🏗️" },
      filologiya: { label: "Filologiya (tillar)", icon: "🗣️" },
      sanat: { label: "San'at", icon: "🎨" },
      sport: { label: "Sport", icon: "⚽" },
      qishloq: { label: "Qishloq xo'jaligi", icon: "🌾" },
      turizm: { label: "Turizm", icon: "🧳" },
    };

    const categories = Object.entries(this.CATEGORY_KEYWORDS).map(([key]) => {
      const meta = categoryLabels[key] || { label: key, icon: "📚" };
      return {
        id: key,
        label: meta.label,
        icon: meta.icon,
      };
    });

    return {
      tool: "list_directions" as any,
      success: true,
      data: { categories },
    };
  }

  /**
   * NARX BO'YICHA QIDIRUV — "eng arzon universitet", "kontrakt narxi qancha".
   *
   * Universitetlarni user-side dan olib, minimal kontrakt narxi bo'yicha
   * o'sish tartibida saralaydi va eng arzonlarini qaytaradi.
   */
  private async searchTuition(intent: IntentResult, sessionContext?: any, userMessage?: string): Promise<ToolResult> {
    const { region, institutionCategory } = intent.entities;

    try {
      const filterResult = await externalApi.getUniversitiesFilter({ limit: 200 });
      let universities: any[] = [];
      if (Array.isArray(filterResult?.data)) universities = filterResult.data;
      else if (Array.isArray(filterResult)) universities = filterResult;

      // MUHIM (Fix: turizm): texnikum/kollej/litsey OTM emas — chiqarib tashlanadi
      universities = universities.filter((u: any) => this.isUniversityLike(u));

      if (universities.length === 0) {
        return { tool: "search_tuition" as any, success: true, data: { hasData: false, universities: [] } };
      }

      // MUHIM (Fix 18): follow-up kontekst — user avval bitta universitet haqida
      // so'ragan bo'lsa (currentTopicName = university nomi), "kontrakt narxi
      // qancha" desa, UMUMIY narx oralig'i emas, O'SHA UNIVERSITET narxini qaytar.
      // "Toshkent tibbiyot akademiyasi → kontrakti qancha?" → TTA narxi.
      const topicName = (sessionContext?.currentTopicName as string | undefined)?.trim();
      const universityEntity = intent.entities?.university as string | undefined;
      // MUHIM (prod fix): topicName ni faqat "bare" kontrakt savolida ishlatamiz
      // ("kontrakti qancha", "narxi qancha" — boshqa so'rov emas). "IT yo'nalishi
      // kontrakti" yoki "Eng arzon universitet" kabi yangi so'rovda eski topic
      // ("TATU kontrakt narxi") ishlatilmasligi kerak — aks holda hamma so'rov
      // TATUga yopishib qoladi. Bare savol aniq: faqat kontrakt/narx so'zlari
      // + qancha/necha/bormi, boshqa entity'lar yo'q.
      // BOSQICH 11: "uning narxlari qancha?" kabi pronoun bilan boshlangan
      // savollarni ham BARE kontrakt savoli deb hisoblaymiz — hasOtherQuery
      // false bo'lishi kerak (aks holda lastUniversity yopishib qolmaydi).
      const msgLower = (userMessage || '').toLowerCase().trim()
        .replace(/^(uning|o'sha|ana shu|shu|u|o'shaniki|buning|bularning|ularning)\s+/i, '');
      const hasOtherQuery = !/^(kontrakti?|kontrakt narxi?|narx(i|lari)?|narhi?|to'lovi?|tuition|price)(\s+(narxi|narhlari|to'lovi?))?(\s+(qancha|necha|bormi|bor|qanday))?\s*[?.!]*$/i.test(msgLower);
      const focusUniName = universityEntity || (!hasOtherQuery ? topicName : undefined);
      // Follow-up: user avval aniq university so'ragan bo'lsa (to'liq nom YOKI
      // qisqartma — "TTA", "AMITY", "SamDU"), kontrakt savolida shu univerni
      // ko'rsatamiz. Umumiy topic nomlari ("Universitetlar ro'yxati", region,
      // yo'nalish) universitet EMAS — ularni filtrlab tashlaymiz.
      // MUHIM (prod fix): "kontrakt narxi" (singular) ham generic — aks holda
      // avvalgi tuition javobining sarlavhasi ("### 💰 TATU kontrakt narxi")
      // topicName bo'lib qolib, keyingi barcha so'rovlarga yopishib qoladi
      // ("TATU kontrakt narxi kontrakt narxi kontrakt narxi").
      const isGenericTopic = !!focusUniName && /(universitetlar|ro'yxati|yo'nalishlar|grantlar|yangiliklar|katalogi|kontrakt narx|eng arzon|tavsiyalar|topildi)/i.test(focusUniName);
      const isFollowUpTuition = !!focusUniName && focusUniName.length > 2 && !isGenericTopic &&
        (
          /(universitet|university|institut|akademiya|oliygoh|kollej|institute|texnikum)/i.test(focusUniName) ||
          // Qisqartma (TTA, AMITY, SamDU, INHA...) — katta harfli yoki mashhur abbreviatura
          /^[A-Z]{2,}$/.test(focusUniName) ||
          // "toshkent shahridagi amity universiteti" kabi university'ga o'xshash nom
          /\b(amity|westminster|inh[oa]|tatu|tuit|pdp|wiut|samdu|buxdu|fardu|tdiu|tdyu|tktu|tktu|tatu)\b/i.test(focusUniName)
        );

      if (isFollowUpTuition) {
        let focusLower = focusUniName.toLowerCase();
        // Mashhur qisqartmalar → qidiruv kalit so'zlari ("TTA" → "tibbiyot akademiya")
        // Qisqartma full-name da substring bo'lmasligi mumkin — mapping kerak.
        const ABBR_MAP: Record<string, string> = {
          tta: 'tibbiyot akademiya', tmi: 'moliya instituti', tqi: 'qurilish instituti',
          ttpі: 'farmatsevtika instituti', tatu: 'texnologiya universiteti', tuit: 'axborot texnologiyalari',
          samdu: 'samarqand davlat universiteti', buxdu: 'buxoro davlat universiteti',
          fardu: "farg'ona davlat universiteti", namdu: 'namangan davlat universiteti',
          urchdu: 'urganch davlat universiteti', qardu: 'qarshi davlat universiteti',
          anddu: 'andijon davlat universiteti', tdiu: 'iqtisodiyot universiteti',
          tdyu: 'yuridik universiteti', tktu: 'kimyo texnologiya', tdtu: 'texnika universiteti',
          farpi: "farg'ona politexnika", buxpi: 'buxoro muhandislik', andpi: 'andijon mashinasozlik',
        };
        if (ABBR_MAP[focusLower]) focusLower = ABBR_MAP[focusLower];

        // Nom bo'yicha mos university'larni topamiz (to'liq nom / qisqartma)
        const focusWords = focusLower.replace(/[^a-z0-9'\s-]/gi, '').split(/\s+/).filter((w: string) => w.length > 2);
        // Umumiy so'zlar — match'da ustunlik bermasligi kerak
        const stopWords = new Set(['toshkent', 'tashkent', 'universiteti', 'universitet', 'davlat', 'xalqaro', 'xususiy', 'instituti', 'institut', 'akademiyasi', 'akademiya', 'viloyati', 'shahri', 'shahridagi']);
        const keyWords = focusWords.filter((w: string) => !stopWords.has(w));
        const focused = universities.filter((u: any) => {
          const names = [
            u.full_name_uz || '', u.fullNameUz || '',
            u.full_name_ru || '', u.fullNameRu || '',
            u.full_name_en || '', u.fullNameEn || '',
            u.abbr_name_uz || '', u.abbrNameUz || '',
            u.slug || '',
          ].map((s: string) => s.toLowerCase());
          const joined = names.join(' ');
          // 1) To'liq nom mos kelsa — eng aniq match (TTA)
          if (joined.includes(focusLower)) return true;
          // 2) Kalit so'zlar (stopWords'chi bo'lmagan) 2+ mos kelsa
          const keyMatched = keyWords.filter((w: string) => joined.includes(w));
          if (keyMatched.length >= 2 && keyMatched.length >= Math.ceil(keyWords.length * 0.6)) return true;
          // 3) Faqat stopWords bo'lsa — 3+ so'z mos kelsa ("toshkent tibbiyot akademiyasi")
          if (keyWords.length === 0 && focusWords.length >= 3) {
            const matched = focusWords.filter((w: string) => joined.includes(w));
            if (matched.length >= focusWords.length - 1) return true;
          }
          return false;
        });
        if (focused.length > 0) {
          // BOSQICH 11: fokuslangan universitеtni ham eslab qolamiz — keyingi
          // follow-up'lar ("yotoqxonasi bormi?") shu univga bog'lanadi.
          this.rememberUniversity(sessionContext, focused[0]);
          // Fix 19: to'liq nom mos kelgan (joined.includes(focusLower)) univ
          // birinchi o'ringa chiqsin — aks holda "TATU kontrakti qancha?" da
          // "Axborot texnologiyalari va menejment universiteti" TATU'dan oldin
          // ko'rinib qolardi (ikkalasi ham "axborot texnologiyalari" kalit
          // so'ziga mos kelgani uchun). Aniq match: 0, qisman match: 1.
          const focusedSorted = focused.sort((a: any, b: any) => {
            const aNames = [a.full_name_uz || '', a.fullNameUz || '', a.full_name_en || '', a.fullNameEn || '', a.slug || ''].join(' ').toLowerCase();
            const bNames = [b.full_name_uz || '', b.fullNameUz || '', b.full_name_en || '', b.fullNameEn || '', b.slug || ''].join(' ').toLowerCase();
            const aExact = aNames.includes(focusLower) ? 0 : 1;
            const bExact = bNames.includes(focusLower) ? 0 : 1;
            if (aExact !== bExact) return aExact - bExact;
            return (bNames.length - aNames.length);
          });
          universities = focusedSorted.slice(0, 3);
          console.log(`[Tuition] Follow-up: "${focusUniName}" → ${focused.length} ta mos university`);
        }
      }

      // Region nomi bo'yicha taxminiy filtr (user-side yukini kamaytirish)
      const targetRegionName = region ? lookupManager.getRegionName(parseInt(region), 'uz').toLowerCase() : null;
      if (targetRegionName) {
        const shortName = targetRegionName.replace(' viloyati', '').replace(' shahri', '').replace(' respublikasi', '').trim();
        universities = universities.filter((u: any) =>
          (u.full_name_uz || '').toLowerCase().includes(shortName) ||
          (u.full_name_ru || '').toLowerCase().includes(shortName) ||
          (u.full_name_en || '').toLowerCase().includes(shortName)
        );
      }

      // MUHIM (Fix: stress test): "20 mln gacha IT universitetlar" kabi so'rovda
      // direction entity ("it") keladi, lekin searchTuition uni ishlatmasdi —
      // natijada "Xalqaro qishloq xo'jaligi", "Iqtisodiyot va pedagogika" kabi
      // IT'ga aloqasi YO'Q univlar ham chiqardi. Yechim: direction berilgan bo'lsa
      // nomida kategoriya terminlari bor univlarni oldinga surish (pre-sort),
      // so'ng user-side + directions orqali major-density qoidasidan o'tganlarni
      // saqlash. Xuddi recommend()'dagi kabi.
      const directionEntity = (intent.entities?.direction as string | undefined);
      const tuitionCatTerms = directionEntity
        ? (this.CATEGORY_KEYWORDS[directionEntity] || []).filter((t: string) => t.length > 3)
        : [];
      if (tuitionCatTerms.length > 0) {
        const scoredPool = universities.map((u: any) => {
          const name = `${u.full_name_uz || ''} ${u.full_name_ru || ''} ${u.full_name_en || ''}`.toLowerCase();
          let score = 0;
          for (const t of tuitionCatTerms) if (name.includes(t)) score += 10;
          return { u, score };
        });
        scoredPool.sort((a: any, b: any) => b.score - a.score);
        universities = scoredPool.map((s: any) => s.u);
        console.log(`[Tuition] Pre-sort: "${directionEntity}" yo'nalish termini bo'yicha`);
      }

      const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
      const batch = universities.slice(0, 40);
      const userSideResults = await Promise.allSettled(
        batch.map((u: any) =>
          Promise.race([externalApi.getUniversityUserSide(u.id), timeout(5000)])
        )
      );

      // DIRECTION FILTER (Fix): direction berilgan bo'lsa, faqat shu yo'nalishga
      // ega (major-density qoidasidan o'tgan) univlarni saqlaymiz — xuddi
      // recommend()'dagi hard-filter kabi. Aks holda "IT universitetlar" so'roviga
      // IT yo'nalishi bo'lmagan univlar chiqib qolardi.
      let directionMatchedIds: Set<number> | null = null;
      if (tuitionCatTerms.length > 0) {
        directionMatchedIds = new Set<number>();
        const dirRequests = batch.map((u: any) => ({
          uni: u,
          request: Promise.race([externalApi.getDirectionsByUniversity(u.id), timeout(4000)]),
        }));
        const dirResults = await Promise.allSettled(dirRequests.map((r) => r.request));
        dirResults.forEach((r, idx) => {
          if (r.status === 'fulfilled' && Array.isArray(r.value)) {
            const uni = dirRequests[idx].uni;
            const totalDirs = r.value.length;
            const strongNames = new Set<string>();
            const expandedTerms = this.expandSearchKeyword(directionEntity as string);
            for (const d of r.value) {
              const nameUz = (d.name_uz || '').toLowerCase();
              const nameEn = (d.name_en || '').toLowerCase();
              let matchStrong = false;
              for (const term of expandedTerms) {
                if (this.termMatchesDirection(nameUz, term) || this.termMatchesDirection(nameEn, term)) {
                  if (!this.isGenericDirectionTerm(term)) { matchStrong = true; break; }
                }
              }
              if (matchStrong) {
                const key = (d.name_uz || d.name_en || '').toLowerCase().replace(/\s+/g, ' ').trim();
                if (key) strongNames.add(key);
              }
            }
            const strongCount = strongNames.size;
            if (strongCount >= 1) {
              const catShare = strongCount / Math.max(totalDirs, 1);
              const rule = this.getMajorDensityRule(directionEntity as string);
              const passes = (strongCount >= rule.minStrong && catShare >= rule.minShare) || catShare >= rule.orShare;
              console.log(`[Tuition] Major-density: ${(uni.full_name_uz || uni.full_name_en || '').substring(0, 40)} — ${strongCount} ta aniq, ulush ${Math.round(catShare * 100)}% → ${passes ? "O'TDI" : "chiqarildi"}`);
              if (passes) directionMatchedIds!.add(uni.id);
            }
          }
        });
        console.log(`[Tuition] Direction filter: ${directionMatchedIds.size} ta univda "${directionEntity}" bor`);
      }

      const withTuition: Array<{ name: string; slug: string; tuition: string; min: number; max: number; location: string; type: string }> = [];
      for (const r of userSideResults) {
        if (r.status === 'fulfilled' && r.value?.id) {
          const uni = r.value;
          // DIRECTION FILTER: mos yo'nalishga ega bo'lmagan univni chiqarib tashla
          if (directionMatchedIds && !directionMatchedIds.has(uni.id)) continue;

          // Kategoriya bo'yicha tekshirish (Fix): "davlat yoki xalqaro" kombinatsiyalari
          if (!this.matchesInstitutionCategory(uni.institution_category_id, intent.entities)) continue;

          // BOSQICH 2: byudjet chegaralari + degree/language/educationType filtrlari
          // "20 mln gacha" desa, minimal to'lovi 20 mln dan oshganlar chiqib ketadi.
          // (Byudjet logikasi matchesAdvancedFilters ichida — bu yerda dublikat qilmaymiz!)
          if (!this.matchesAdvancedFilters(uni, intent.entities)) continue;

          const u = this.normalizeUniversity(uni);
          if (u.minimalTuitionFee || u.maximalTuitionFee) {
            withTuition.push({
              name: u.fullNameUz || u.fullNameEn,
              slug: u.slug,
              tuition: u.tuition,
              min: u.minimalTuitionFee || 0,
              max: u.maximalTuitionFee || 0,
              location: u.location || '',
              type: u.institutionCategory || '',
            });
          }
        }
      }

      if (withTuition.length === 0) {
        return { tool: "search_tuition" as any, success: true, data: { hasData: false, universities: [] } };
      }

      // Eng arzondan qimmatga saralash.
      // MUHIM (Fix 19): follow-up holatida (user AVVAL bitta universitet
      // so'ragan — "TATU → Kontrakti qancha?") narx bo'yicha saralamaymiz —
      // aks holda arzonroq qisman-match univ (ATMU 10 mln) aniq-match TATU'dan
      // (13 mln) oldin ko'rinib qoladi. Follow-up'da foydalanuvchi O'SHA
      // universitеtni so'rayapti, eng arzonini emas!
      if (!isFollowUpTuition) {
        withTuition.sort((a, b) => (a.min > 0 ? a.min : a.max) - (b.min > 0 ? b.min : b.max));
      }
      const minTuition = Math.min(...withTuition.map((u) => (u.min > 0 ? u.min : u.max)));
      const maxTuition = Math.max(...withTuition.map((u) => u.max));

      return {
        tool: "search_tuition" as any,
        success: true,
        data: {
          hasData: true,
          minTuition,
          maxTuition,
          universities: withTuition.slice(0, 10),
          // Fix 18: follow-up holatida — user avval bitta universitet so'ragan
          // bo'lsa, formatter "Umumiy narx oralig'i" emas, shu university deb ko'rsatadi.
          isFollowUp: isFollowUpTuition,
          focusName: isFollowUpTuition ? focusUniName : undefined,
        },
      };
    } catch (error) {
      return this.errorResult("search_tuition", "Narx ma'lumotlarini olishda xatolik", error);
    }
  }

  private async searchGrants(intent: IntentResult, sessionContext?: any): Promise<ToolResult> {
    const { university, region } = intent.entities;

    try {
      const result = await externalApi.getGrants({
        university: university?.toLowerCase(),
        region: region ? lookupManager.getRegionName(parseInt(region), "uz") : undefined,
        limit: 20,
      });

      const grants = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];

      // BOSQICH 11: aniq universitet so'ralgan bo'lsa ("PDP grantlari"),
      // shu universitеtni eslab qolamiz — keyingi follow-up shu univga bog'lanadi.
      if (sessionContext && university && grants.length > 0) {
        const first = grants[0];
        const uniName = first?.universityNameUz || first?.university_name_uz || university;
        sessionContext.lastUniversity = {
          id: first?.universityId || first?.university_id || undefined,
          name: uniName,
          slug: first?.universitySlugName || first?.university_slug_name || undefined,
        };
      }

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
      return this.errorResult("search_grants", "Grant ma'lumotlarini olishda xatolik", error);
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
      return this.errorResult("search_news", "Yangilik ma'lumotlarini olishda xatolik", error);
    }
  }

  private async compareUniversities(intent?: IntentResult, userMessage?: string): Promise<ToolResult> {
    try {
      // Filterdan 10 ta universitet olamiz
      const result = await externalApi.getUniversitiesFilter({ limit: 200 });
      let universities = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
      if (Array.isArray(result?.entities)) universities = result.entities;

      // MUHIM (Fix: turizm): texnikum/kollej/litsey OTM emas — chiqarib tashlanadi
      universities = universities.filter((u: any) => this.isUniversityLike(u));

      // MUHIM (Fix: stress test): "Davlatmi yoki xususiymi, qaysi yaxshi?" kabi
      // savolda aniq universitet nomi YO'Q — findMentionedUniversities "davlat"
      // so'zini nom deb hisoblab, nomida "davlat" bor barcha univlarni (Andijon,
      // Buxoro, Farg'ona DU...) topardi va kategoriya branch'i ishlamas edi →
      // generic javob ("har ikkalasi o'ziga xos afzalliklarga ega" — gapni olib
      // qochish!). Yechim: institutionCategory entity bo'lsa, findMentionedUniversities
      // o'tkazib yuboriladi va kategoriyadan 2-3 tadan univ tanlanadi — LLM aniq
      // misollar bilan taqqoslaydi.
      const entities = intent?.entities || {};
      const hasCategoryEntity = !!entities.institutionCategory ||
        (Array.isArray(entities.institutionCategories) && entities.institutionCategories.length > 0);
      // MUHIM (reviewer fix): findMentionedUniversities HAR DOIM chaqiriladi —
      // "TATU va INHA, davlatmi yoki xususiymi?" kabi ARALASH savolda aniq nomlar
      // (TATU/INHA) ustun bo'lishi kerak. Kategoriya tanlash faqat aniq nom
      // topilmaganda ishlaydi.
      const mentioned = this.findMentionedUniversities(userMessage, universities, 5);
      if (mentioned.length > 0) {
        universities = mentioned;
      } else if (hasCategoryEntity) {
        // Kategoriya bo'yicha univ tanlash: user-side ma'lumot orqali kategoriyani
        // aniqlab, har bir kategoriyadan 2 tadan vakil olamiz.
        const cats = Array.isArray(entities.institutionCategories) && entities.institutionCategories.length > 0
          ? entities.institutionCategories
          : [entities.institutionCategory];
        // MUHIM (Fix: stress test): API tartibida birinchi 60 ta deyarli hammasi
        // XUSUSIY + XALQARO (davlatlar 60 dan keyin!). Ilgari 40 ta tekshirilardi
        // — "Davlatmi yoki xususiymi?" so'rovida davlat univlari TOPILMAS qolardi.
        // Endi: har bir so'ralgan kategoriyadan kamida 2 ta topilmaguncha chunk'lab
        // tekshiramiz (maksimal 120 ta).
        const wanted = new Map<string, number>();
        for (const cat of cats) { if (cat) wanted.set(String(cat), 2); }
        const byCat: Record<string, any[]> = {};
        const chunkSize = 40;
        // Review fix: eng yomon holatda cheksiz API call oldini olish — 160 tadan
        // oshirilmaydi (har bir so'ralgan kategoriyadan 2 tadan topish uchun yetarli).
        const maxCheck = Math.min(universities.length, 160);
        for (let start = 0; start < maxCheck && [...wanted.values()].some((n) => n > 0); start += chunkSize) {
          const chunk = universities.slice(start, start + chunkSize);
          const catUnis = await Promise.allSettled(
            chunk.map((u: any) =>
              Promise.race([externalApi.getUniversityUserSide(u.id), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))])
            )
          );
          catUnis.forEach((r) => {
            if (r.status === 'fulfilled' && r.value?.id) {
              const catId = String(r.value.institution_category_id);
              if (!wanted.has(catId)) return;
              if (!byCat[catId]) byCat[catId] = [];
              if (byCat[catId].length < (wanted.get(catId) || 2)) byCat[catId].push(r.value);
            }
          });
          // Qaysi kategoriyalar hali to'lmaganini hisoblaymiz
          for (const [cat, need] of wanted) {
            const have = (byCat[cat] || []).length;
            wanted.set(cat, have >= 2 ? 0 : 2 - have);
          }
          console.log(`[Compare] Kategoriya tekshiruvi: ${start + chunk.length} ta tekshirildi, davlat=${(byCat['3'] || []).length}, xususiy=${(byCat['4'] || []).length}, xalqaro=${(byCat['5'] || []).length}`);
        }
        const picked: any[] = [];
        for (const cat of cats) {
          if (!cat) continue;
          for (const u of byCat[String(cat)] || []) picked.push(u);
        }
        if (picked.length >= 2) {
          universities = picked;
          console.log(`[Compare] Kategoriya asosida: ${picked.length} ta univ tanlandi (${cats.join(', ')})`);
        } else if (picked.length > 0) {
          universities = picked;
        }
      }

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
      return this.errorResult("compare_universities", "Taqqoslash ma'lumotlarini olishda xatolik", error);
    }
  }

  private async getAdmissionInfo(intent: IntentResult, sessionContext?: any): Promise<ToolResult> {
    const { university } = intent.entities;

    try {
      const result = await externalApi.getUniversitiesFilter({
        search: university || undefined,
        limit: 10,
      });

      let universities = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
      // MUHIM (Fix: turizm): texnikum/kollej/litsey OTM emas — chiqarib tashlanadi
      universities = universities.filter((u: any) => this.isUniversityLike(u));

      // BOSQICH 11: qabul ma'lumoti ko'rilgan universitеtni ham eslab qolamiz
      if (universities.length > 0) this.rememberUniversity(sessionContext, universities[0]);

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
      return this.errorResult("get_university", "Qabul ma'lumotlarini olishda xatolik", error);
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
      return this.errorResult("search_direction", "Ko'chirish ma'lumotlarini olishda xatolik", error);
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
        region?: string;              // location ID or name (home)
        preferredCities?: string[];   // YANGI: afzal o'qish shaharlari ["toshkent", "samarqand"]
        directionCategory?: string;   // it, tibbiyot, iqtisod, biomedical...
        institutionCategory?: string; // 3=davlat, 4=xususiy, 5=xalqaro
        institutionCategories?: string[]; // YANGI (Fix): "davlat yoki xalqaro" → ["3", "5"]
        degree?: string;
        educationType?: string;
        language?: string;
        englishLevel?: string;        // YANGI: "C1", "B2", "IELTS 7.0"
        interestGrant?: boolean;
        interestAccommodation?: boolean;
        wantsInternational?: boolean; // YANGI: xalqaro diplom kerak
        tuitionMax?: number;          // byudjet yuqori chegarasi
        tuitionMin?: number;          // byudjet pastki chegarasi
        wantsForeign?: boolean;       // xorijga ketmoqchi
        weaknesses?: string[];        // zaif fanlar ("matematika") — Reasoning v2
        careerGoal?: string;          // YANGI: "ai_medicine", "medicine"
        admissionFailed?: boolean;    // STAGE 14: "imtihondan yiqildim" → xususiy univlar ustun
      } = {};

      // Intent entities dan olish
      const entities = intent.entities || {};
      if (entities.region) preferences.region = entities.region;
      if (entities.institutionCategory) preferences.institutionCategory = entities.institutionCategory;
      // MUHIM (Fix): "davlat yoki xalqaro" → ["3", "5"] — ikkala kategoriya
      // ham filterda ishlatiladi (bitta emas).
      if (Array.isArray(entities.institutionCategories) && entities.institutionCategories.length > 0) {
        preferences.institutionCategories = entities.institutionCategories;
        // Bitta qiymat o'rniga array ustun — filterda ikkalasi tekshiriladi.
        preferences.institutionCategory = entities.institutionCategories[0];
      }
      if (entities.degree) preferences.degree = entities.degree;
      if (entities.educationType) preferences.educationType = entities.educationType;
      if (entities.language) preferences.language = entities.language;
      if (entities.grantType) preferences.interestGrant = true;
      if (entities.accommodation === "true") preferences.interestAccommodation = true;
      // MUHIM (reviewer fix): byudjet entity'lari preferences ga o'tkazilishi
      // kerak — aks holda computeRecommendationScore budget bo'limi o'lik kod bo'lib
      // qoladi (doim neytral ball). "20 mln gacha" → tuitionMax.
      if (entities.tuitionMax !== undefined) preferences.tuitionMax = entities.tuitionMax;
      if (entities.tuitionMin !== undefined) preferences.tuitionMin = entities.tuitionMin;
      // MUHIM (Fix 14): "tibbiyot" kabi qisqa javob follow-up kontekstida
      // entities.direction bo'lib keladi — uni preferences.directionCategory ga
      // o'tkazish kerak, aks holda dialog davomida yo'nalish yo'qoladi.
      if (entities.direction) preferences.directionCategory = entities.direction;
      // YANGI: profil entitylar
      if (entities.preferredCities && entities.preferredCities.length > 0)
        preferences.preferredCities = entities.preferredCities;
      if (entities.englishLevel) preferences.englishLevel = entities.englishLevel;
      if (entities.wantsInternational) preferences.wantsInternational = true;
      if (entities.careerGoal) preferences.careerGoal = entities.careerGoal;
      // STAGE 14 — USER STATE: "imtihondan yiqildim" → xususiy univlar ustun.
      // USTOVORLIK (user qoidasi): explicit institutionCategory so'rovidan keyin
      // keladi — user "davlat universiteti" desa, admissionFailed HECh qanday
      // private-first qilmaydi (quyida scoring'da explicit tekshiriladi).
      if (sessionContext?.recommendationProfile?.admissionFailed) {
        preferences.admissionFailed = true;
      }

      // Session context dan olish
      if (sessionContext) {
        if (!preferences.region && sessionContext.currentRegion) preferences.region = sessionContext.currentRegion;
        if (!preferences.institutionCategory && sessionContext.currentInstitutionCategory) 
          preferences.institutionCategory = sessionContext.currentInstitutionCategory;
        // Fix: follow-up'da ham "davlat yoki xalqaro" kombinatsiyasi saqlanadi
        if (Array.isArray(sessionContext.currentInstitutionCategories) && sessionContext.currentInstitutionCategories.length > 0) {
          preferences.institutionCategories = sessionContext.currentInstitutionCategories;
          preferences.institutionCategory = sessionContext.currentInstitutionCategories[0];
        }
        if (!preferences.degree && sessionContext.currentDegree) preferences.degree = sessionContext.currentDegree;
        if (sessionContext.interestGrant) preferences.interestGrant = true;
        // MUHIM (Fix 14 davomi): oldingi javobda saqlangan yo'nalish kategoriyasi
        // keyingi javobda ham ishlatilishi kerak ("samarqand → tibbiyot → davlat").
        if (!preferences.directionCategory && sessionContext.currentDirectionCategory) 
          preferences.directionCategory = sessionContext.currentDirectionCategory;
      }

      // ===== RECOMMENDATION PROFILE (BOSQICH 9) =====
      // Session bo'ylab to'plangan profilni preferences ga integratsiya qilish:
      // "Matematikam yaxshi → Pulim kam → Toshkentda" zanjirida har bir javob
      // oldingi profile ma'lumotlarini ham ishlatadi.
      const profile = sessionContext?.recommendationProfile;
      if (profile) {
        // Home region (qayerdan, emas qayerda o'qishni xohlayman)
        if (!preferences.region && profile.city) preferences.region = profile.city;
        if (!preferences.degree && profile.degree) preferences.degree = profile.degree;
        if (!preferences.language && profile.language) preferences.language = profile.language;
        // YANGI: ingliz darajasi
        if (!preferences.englishLevel && profile.englishLevel) preferences.englishLevel = profile.englishLevel;
        // YANGI: afzal shaharlar — home region'dan ustun keladi
        if (!preferences.preferredCities && profile.preferredCities?.length)
          preferences.preferredCities = profile.preferredCities;
        // YANGI: kasb maqsadi
        if (!preferences.careerGoal && profile.careerGoal) preferences.careerGoal = profile.careerGoal;
        // YANGI: yotoqxona va xalqaro diplom
        if (profile.wantsHostel) preferences.interestAccommodation = true;
        if (profile.wantsInternational) preferences.wantsInternational = true;
        if (!preferences.directionCategory && profile.interests?.length) {
          // Qiziqishlardan yo'nalish aniqlash ("AI" → it)
          const detectedFromInterests = detectDirectionCategory(profile.interests.join(" "));
          if (detectedFromInterests) preferences.directionCategory = detectedFromInterests;
        }
        if (profile.interestGrant) preferences.interestGrant = true;
        // Byudjet: aniq son ustun, daraja fallback
        if (preferences.tuitionMax === undefined && profile.budget) {
          preferences.tuitionMax = profile.budget;
        } else if (preferences.tuitionMax === undefined && profile.budgetLevel === "low") {
          preferences.tuitionMax = 25_000_000; // "kam" — 25 mln gacha
        }
        // Xorijga ketmoqchi → xalqaro univlar yuqori ball oladi (score bonus)
        if (profile.wantsForeign) preferences.wantsForeign = true;
        // Zaif fanlar ("matematikam yaxshi emas") → ball chegiemasi (Reasoning v2)
        if (profile.weaknesses?.length) preferences.weaknesses = profile.weaknesses;
      }

      // preferredCities bo'lsa, region ni ustiga qo'yamiz (o'qish joyi home'dan muhim)
      // Agar preferredCities ["toshkent"] bo'lsa va region = "3" (Buxoro) bo'lsa
      // → filterlash Toshkent asosida ishlaydi
      const activeRegions = preferences.preferredCities && preferences.preferredCities.length > 0
        ? preferences.preferredCities
        : null;
      console.log(`[Recommend] Preferences: dir=${preferences.directionCategory}, ` +
        `region=${preferences.region}, preferredCities=${JSON.stringify(preferences.preferredCities)}, ` +
        `budget=${preferences.tuitionMax}, grant=${preferences.interestGrant}, ` +
        `hostel=${preferences.interestAccommodation}, international=${preferences.wantsInternational}, ` +
        `englishLevel=${preferences.englishLevel}, careerGoal=${preferences.careerGoal}`);

      // User message dan direction category ni aniqlash
      // MUHIM: includes(cat) ishlatilmaydi — "tarjima" tarkibidagi "it" sabab IT ga tushib ketadi!
      // Sinonimlar modulidan foydalanamiz: "meditsina", "vrach", "shifokor" → tibbiyot
      // MUHIM (reviewer): agar entities.direction/sessionContext allaqachon o'rnatgan
      // bo'lsa (Fix 14), message-dan aniqlash UNI ustiga YOZMASLIGI kerak — aks holda
      // "tibbiyot" javobidan keyin keyingi qadamda yo'nalish yo'qolishi mumkin.
      if (!preferences.directionCategory) {
        const msgLower = (userMessage || '').toLowerCase();
        const detectedDirCategory = detectDirectionCategory(msgLower);
        if (detectedDirCategory) {
          preferences.directionCategory = detectedDirCategory;
        } else {
          // Fallback: aniq kategoriya nomi (sinonim topilmasa)
          const categoryKeywords = Object.keys(this.CATEGORY_KEYWORDS);
          for (const cat of categoryKeywords) {
            const escapedCat = cat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (new RegExp('\\b' + escapedCat + '\\b', 'i').test(msgLower)) {
              preferences.directionCategory = cat;
              break;
            }
          }
        }
      }

      // ===== 2. MUHIM ma'lumotlar tekshiruvi =====
      const missing: string[] = [];
      if (!preferences.region) missing.push("region");
      if (!preferences.directionCategory) missing.push("directionCategory");
      if (!preferences.institutionCategory && !preferences.institutionCategories?.length) missing.push("institutionCategory");

      // Fix 16: foydalanuvchi "bilmadim" desa cheksiz savol so'ramaymiz —
      // unga yo'nalishlar ro'yxatini taklif qilamiz (katalog) yoki yordam beramiz.
      // MUHIM (reviewer): savol qo'shimchali shakllar ham qo'shildi (bilmammi,
      // bilmaymanmi) va barcha preference'lar to'lgan bo'lsa, cantAnswer EMAS —
      // o'sha holda tavsiyalar ko'rsatiladi.
      const noAnswerPhrases = /\b(bilmadim|bilmayman|bilmayapman|bilolmayman|bilmasam|bilmiman|bilmam|bilmammi|bilmaymanmi|tanlovim yo'q|xohlamayman|nimani tanlashni bilmayman|o'zim bilmayman|nima bilay)\b/i.test(userMessage || "");
      // MUHIM (Fix): "Men tarix faniga qiziqaman lekin qanday universitetda o'qishni
      // bilmayman" — user "bilmayman" deyapti, lekin YO'NALISHNI biladi (tarix).
      // Direction aniqlangan bo'lsa cantAnswer ishlamaydi — shu yo'nalish bo'yicha
      // tavsiyalar qidiriladi. CantAnswer faqat YO'NALISH HAM noaniq bo'lganda
      // ("men nima o'qishni bilmayman") yo'nalishlar ro'yxati taklif qilinadi.
      // cantAnswer: user "bilmadim" desa — cheksiz savol so'ramaymiz,
      // yo'nalishlar ro'yxati taklif qilinadi (faqat YO'NALISH ham noaniq bo'lsa).
      const cantAnswer = noAnswerPhrases && missing.length > 0 && !preferences.directionCategory;
      if (cantAnswer) {
        console.log(`[Recommend] "bilmadim" — javob berilmadi, yo'nalishlar ro'yxati taklif qilinmoqda`);
        return {
          tool: "recommend" as any,
          success: true,
          data: {
            needsClarification: true,
            cantAnswer: true,
            preferences: {
              known: preferences,
              missing: missing,
            },
          },
        };
      }

      // Agar haligacha yetarli ma'lumot bo'lmasa → clarification so'raymiz
      // SOFT CLARIFICATION (BOSQICH 14): guided conversation — directionCategory
      // bo'lsa ham yetishmayotgan ma'lumot bitta-bitta so'raladi (interrogation
      // emas). User javob bergach profile yig'iladi va navbatdagi savol so'raladi.
      // MUHIM: cantAnswer bo'lsa ("bilmadim") qidiruvga o'tamiz — cheksiz
      // savol so'ralmaydi.
      if (missing.length > 0 && !cantAnswer) {
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

      // ===== GUEST REJIM (BOSQICH 1 + GUEST) =====
      // Clarification dialog (yuqorida) API'siz ishladi — "Qaysi shahar? Qanday
      // yo'nalish? Davlatmi yoki xususiy?" suhbatini guest ham yuritishi mumkin.
      // Endi REAL ma'lumot (API) kerak bo'lsa → bloklanadi, login so'raladi.
      // (authRequired=true → provider-manager login so'rovini ko'rsatadi)
      if (sessionContext?.isGuest) {
        console.log(`[ToolAccessPolicy] GUEST → recommend (ma'lumot yig'ish) BLOKLANDI — login talab qilinadi`);
        return { tool: "recommend" as any, success: false, authRequired: true };
      }

      // ===== 3. MA'LUMOTLARNI YIG'ISH =====
      // Universitetlarni olish (filter orqali)
      const filterResult = await externalApi.getUniversitiesFilter({ limit: 200 });
      let universities: any[] = [];
      if (Array.isArray(filterResult?.data)) universities = filterResult.data;
      else if (Array.isArray(filterResult)) universities = filterResult;

      // MUHIM (Fix: turizm): texnikum/kollej/litsey OTM emas — chiqarib tashlanadi
      universities = universities.filter((u: any) => this.isUniversityLike(u));

      if (universities.length === 0) {
        return { tool: "recommend" as any, success: true, data: { recommendations: [], preferences } };
      }

      const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

      // Kategoriya va region bo'yicha filtr uchun user-side ma'lumotini olamiz
      // MUHIM (Fix 12): ilgari faqat birinchi 60 ta tekshirilardi — davlat
      // universitetlari (masalan Samarqand davlat tibbiyot universiteti #122,
      // Toshkent tibbiyot akademiyasi #139) filter ro'yxatida 90-140 o'rinlarda
      // keladi → "tibbiyot" javobida topilmasdi. Endi: region ko'rsatilgan bo'lsa
      // nomida region so'zi borlar BIRINCHI tekshiriladi (shaharni nomiga kiritgan
      // davlat univlari shu yerda), so'ng qolganlar chunk'lab tekshiriladi —
      // ko'rsatish uchun 5 ta mos topilsa to'xtaymiz.
      let searchPool = universities;
      // Fix: pre-sort — region VA kategoriya nomlari bo'yicha univlarni oldinga
      // surish. Sabab: API tartibida birinchi 20-25 talik asosan xususiy/xalqaro
      // IT-fokusli univlar (Acharya, Amity, AUT...) — tibbiyot univlari esa
      // #19-#138 o'rinlarda tarqoq (SamDTM #81, TTA #123). matchedUniversities
      // MIN_MATCH_NEEDED=20 bilan BIRINCHI 20 ta mosda to'xtagani uchun
      // "shifokor" so'rovida tibbiyot univlari hech qachon tekshirilmasdi →
      // "topilmadi". Endi nomida kategoriya termini (tibbiyot, stomatolog,
      // agrar, pedagogika...) bor univlar oldinga chiqadi.
      const regionBase = preferences.region
        ? lookupManager.getRegionName(parseInt(preferences.region), 'uz').toLowerCase().replace(/ (viloyati|shahri|respublikasi)$/i, '').trim()
        : '';
      const catTerms = preferences.directionCategory
        ? (this.CATEGORY_KEYWORDS[preferences.directionCategory] || []).filter((t: string) => t.length > 3)
        : [];
      if (regionBase || catTerms.length > 0) {
        const scoredPool = universities.map((u: any) => {
          const name = `${u.full_name_uz || ''} ${u.full_name_ru || ''} ${u.full_name_en || ''}`.toLowerCase();
          let score = 0;
          if (regionBase && name.includes(regionBase)) score += 1000;
          for (const t of catTerms) if (name.includes(t)) score += 10;
          return { u, score };
        });
        scoredPool.sort((a: any, b: any) => b.score - a.score);
        searchPool = scoredPool.map((s: any) => s.u);
        console.log(`[Recommend] Pre-sort: region="${regionBase || '-'}" kategoriya="${preferences.directionCategory || '-'}" bo'yicha`);
      }

      // Mos universitetlarni topish (chunk'langan, 5 ta topilsa to'xtaydi)
      // MUHIM (Fix): directionCategory berilgan bo'lsa ko'proq univ tekshiriladi
      // (20 tagacha) — aks holda "tarix" kabi yo'nalishlar birinchi 5-10 talikda
      // bo'lmagan davlat univlarda (O'zMU, SamDU...) topilmay qoladi. Tekshirish
      // uchun yetarli univ bo'lmasa bo'sh natija qaytadi ("topilmadi").
      // 25 emas 20 — API yuki va kechikishni muvozanatlash (reviewer taklifi).
      const matchedUniversities: any[] = [];
      const USER_SIDE_CHUNK = 10;
      // directionCategory bo'lsa ko'proq univ tekshiriladi (40) — aks holda nomida
      // kategoriya so'zi bo'lmagan, lekin yo'nalishi bor univlar (masalan huquq
      // uchun JIDU, tarix uchun O'zMU/SamDU) 20 talikdan tashqarida qolib,
      // "topilmadi" berardi. 40 ta = barcha asosiy davlat/xalqaro univlar qamrab
      // olinadi (reviewer taklifi).
      const MIN_MATCH_NEEDED = preferences.directionCategory ? 40 : 5;
      for (let i = 0; i < searchPool.length; i += USER_SIDE_CHUNK) {
        const chunk = searchPool.slice(i, i + USER_SIDE_CHUNK);
        const chunkResults = await Promise.allSettled(
          chunk.map((u: any) =>
            Promise.race([externalApi.getUniversityUserSide(u.id), timeout(5000)])
          )
        );
        for (const result of chunkResults) {
          if (result.status === 'fulfilled' && result.value?.id) {
            const uni = result.value;
            const catId = uni.institution_category_id;

            // Kategoriya filtri (Fix): "davlat yoki xalqaro" kabi bir nechta
            // kategoriya tanlanganda array bo'yicha tekshiramiz.
            if (preferences.institutionCategories?.length) {
              if (!preferences.institutionCategories.includes(catId?.toString())) continue;
            } else if (preferences.institutionCategory && catId?.toString() !== preferences.institutionCategory) continue;

            // Region / Preferred Cities filtri
            if (preferences.preferredCities && preferences.preferredCities.length > 0) {
              const locLower = `${uni.location_uz || ''} ${uni.full_name_uz || ''} ${uni.full_name_en || ''}`.toLowerCase();
              const hasPreferredCity = preferences.preferredCities.some((c: string) => locLower.includes(c.toLowerCase()));
              if (!hasPreferredCity) continue;
            } else if (preferences.region) {
              const locLower = (uni.location_uz || '').toLowerCase();
              const regionName = lookupManager.getRegionName(parseInt(preferences.region), 'uz').toLowerCase();
              const getBase = (s: string) => s.replace(/ (viloyati|shahri|respublikasi)$/i, '').trim();
              if (!locLower.includes(getBase(regionName)) && getBase(locLower) !== getBase(regionName)) continue;
            }

            matchedUniversities.push(uni);
          }
        }
        // Ko'rsatish uchun yetarli bo'lsa — keyingi chunk'lar kerak emas
        if (matchedUniversities.length >= MIN_MATCH_NEEDED) break;
      }
      console.log(`[Recommend] User-side filter: ${matchedUniversities.length} ta mos univ`);

      // matchedUniversities 40 tagacha bo'lishi mumkin — barchasini tekshiramiz
      // (slice cheklovi olib tashlandi, reviewer taklifi).
      const matchedDirUnis = matchedUniversities.slice(0, 60);
      const matchedDirections: any[] = [];
      const dirMatchedUniIds = new Set<number>();
      const uniMatchedDirs = new Map<number, string[]>();
      // REVIEWER FIX: har univ uchun ANIQ mos yo'nalishlar sonini saqlaymiz —
      // directionNotFound fallback'ida (minShare yetmagan, lekin minStrong
      // yetgan univlar) qayta hisoblashsiz ishlatish uchun.
      const uniStrongCounts = new Map<number, number>();
      
      if (preferences.directionCategory && matchedDirUnis.length > 0) {
        let expandedTerms = this.expandSearchKeyword(preferences.directionCategory);
        if (preferences.directionCategory === 'biomedical') {
          expandedTerms = Array.from(new Set([
            ...expandedTerms,
            ...this.CATEGORY_KEYWORDS['tibbiyot'],
            ...this.CATEGORY_KEYWORDS['it']
          ]));
        }

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
            const totalDirs = r.value.length;
            // MAJOR-DENSITY (Fix): takrorlanuvchi variantlar ("Kompyuter
            // injiniringi (A/B/C)") ulushni sun'iy oshirmasligi uchun aniq
            // yo'nalish nomlari dedup qilinadi.
            const strongNames = new Set<string>();
            for (const d of r.value) {
              const nameUz = (d.name_uz || '').toLowerCase();
              const nameEn = (d.name_en || '').toLowerCase();
              // MUHIM (Fix: ranking): searchDirection'dagi kabi strong/generic
              // farqi — "Atrof-muhit muhandisligi" kabi faqat generic term bilan
              // mos kelgan yo'nalishlar tavsiyaga kirmasligi kerak.
              let usedTerm = '';
              let matchStrong = false;
              for (const term of expandedTerms) {
                if (this.termMatchesDirection(nameUz, term) || this.termMatchesDirection(nameEn, term)) {
                  if (!this.isGenericDirectionTerm(term)) {
                    usedTerm = term;
                    matchStrong = true;
                    break;
                  }
                  if (!usedTerm) usedTerm = term;
                }
              }
              if (usedTerm) {
                if (matchStrong) {
                  const key = (d.name_uz || d.name_en || '').toLowerCase().replace(/\s+/g, ' ').trim();
                  if (key) strongNames.add(key);
                }
                const name = d.name_uz || d.name_en || '';
                const list = uniMatchedDirs.get(uni.id) || [];
                list.push(name);
                uniMatchedDirs.set(uni.id, list);
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
            // MAJOR-DENSITY HARD FILTER (Fix: user talabi — "alternativ faqat
            // mos yo'nalishli bo'lsin"): kamida 1 ta ANIQ (specific) yo'nalish
            // mosligi talab qilinadi VA yo'nalish ulushi kategoriya qoidasidagi
            // chegaradan yuqori bo'lishi kerak. Qoidalar per-kategoriya sozlanadi
            // (MAJOR_DENSITY_RULES) — real API diagnostikasi asosida:
            //   it:  (3+ VA 6%) YOKI 25% — TATU/INHA/Amity qoladi, transport 3%,
            //        moliya 5.9% chiqariladi.
            //   tibbiyot: (6+ VA 10%) YOKI 45% — TTA/SamDTM/BuxDTM (33-48%),
            //        ZARMED (8 ta, 15%) qoladi; Turon (4/13%), UBS (6/9%) chiqadi.
            //   iqtisod: (5+ VA 15%) YOKI 40% — TDIU/TMI 67% qoladi, 1-2 ta
            //        yo'nalishli periferiklar chiqariladi.
            const strongCount = strongNames.size;
            if (strongCount >= 1) {
              uniStrongCounts.set(uni.id, strongCount);
              const catShare = strongCount / Math.max(totalDirs, 1);
              const rule = this.getMajorDensityRule(preferences.directionCategory);
              const passesMajor = (strongCount >= rule.minStrong && catShare >= rule.minShare) || catShare >= rule.orShare;
              const catLabel = preferences.directionCategory === 'it' ? 'IT' : (preferences.directionCategory || 'soha');
              console.log(`[Recommend] Major-density: ${(uni.full_name_uz || uni.full_name_en || '').substring(0, 45)} — ${strongCount} ta aniq ${catLabel} yo'nalish, ${totalDirs} jami (ulush ${Math.round(catShare * 100)}%) → ${passesMajor ? "O'TDI" : "chiqarildi"}`);
              if (passesMajor) dirMatchedUniIds.add(uni.id);
            }
          }
        });
      }

      // ===== 4. HARD FILTER (majburiy yo'nalish filtri) =====
      // Foydalanuvchi IT/AI/tibbiyot kabi yo'nalish tanlagan bo'lsa — faqat shu
      // yo'nalishga EGA bo'lgan universitetlar qoladi. Yo'nalishi mos kelmagan
      // universitetlar DARHOL chiqarib tashlanadi (scoring'ga ham kirmaydi).
      let recommendableUnis = matchedUniversities;
      if (preferences.directionCategory) {
        if (dirMatchedUniIds.size > 0) {
          recommendableUnis = matchedUniversities.filter((u: any) => dirMatchedUniIds.has(u.id));
          console.log(`[Recommend] Hard filter: ${recommendableUnis.length}/${matchedUniversities.length} ta univda "${preferences.directionCategory}" yo'nalishi bor, qolganlari chiqarildi`);
        } else {
          // REVIEWER FIX (long-test): minShare talabi juda qattiq bo'lishi mumkin
          // — umumiy universitеtlar (SamDU 84+ yo'nalish, IT ulushi 3-5%) yoki
          // kichik shaharlar (Samarqand, Buxoro...) uchun "it" 6% ga yetmaydi,
          // lekin yo'nalish HAQIQATDA bor. Bunday holda minShare'ni pasaytirib
          // fallback qilamiz: kamida minStrong ta ANIQ yo'nalishi bor univlar
          // qoladi ("topilmadi" o'rniga haqiqiy variantlar ko'rsatiladi).
          // Xavfsizlik: minStrong'ga yetmagan univlar hali ham chiqmaydi —
          // "transport 3%" kabi noto'g'ri mosliklar qolmagan.
          const rule = this.getMajorDensityRule(preferences.directionCategory);
          const relaxedIds: number[] = [];
          for (const [uniId, strongCount] of uniStrongCounts) {
            if (strongCount >= rule.minStrong) relaxedIds.push(uniId);
          }
          if (relaxedIds.length > 0) {
            recommendableUnis = matchedUniversities.filter((u: any) => relaxedIds.includes(u.id));
            relaxedIds.forEach((id) => dirMatchedUniIds.add(id));
            console.log(`[Recommend] Hard filter fallback: minShare yumshatildi — ${relaxedIds.length} ta univ (minStrong=${rule.minStrong} yetdi)`);
          } else {
            console.log(`[Recommend] Hard filter: 0 ta — "${preferences.directionCategory}" topilmadi, bo'sh qaytarilmoqda`);
            return {
              tool: "recommend" as any,
              success: true,
              data: { recommendations: [], preferences, directionNotFound: true },
            };
          }
        }
      }

      // MUHIM (Fix: ranking): barcha hard-filterdan o'tgan univlar normalize
      // qilinadi va SCORE qilinadi (slice EMAS!). Ilgari `slice(0, 5)` scoring'dan
      // OLDIN qilinardi — 6-o'rinda turgan, lekin balli yuqori bo'lgan univ hech
      // qachon top-5 ga kira olmasdi. Endi: hard filter → BARCHASINI score qilish
      // → ball bo'yicha saralash → top-5. Best university doim eng yuqori ball
      // olgan univ bo'ladi.
      const enrichedUnis = recommendableUnis.map((u: any) => this.normalizeUniversity(u));

      // Grant ma'lumotini olish
      let grants: any[] = [];
      if (preferences.interestGrant) {
        try {
          const grantResult = await externalApi.getGrants({ region: preferences.region ? lookupManager.getRegionName(parseInt(preferences.region), "uz") : undefined, limit: 10 });
          grants = Array.isArray(grantResult?.data) ? grantResult.data : [];
        } catch {}
      }

      // ===== RECOMMENDATION SCORE (BOSQICH 9) =====
      // Har bir universitetga backend ball hisoblanadi (LLM emas!):
      //   - directionMatch: yo'nalish mosligi (yuqori vazn)
      //   - budgetMatch: byudjetga moslik (narx ≤ budget bo'lsa)
      //   - regionMatch: shahar/viloyat mosligi
      //   - grant / accommodation bonuslari
      // Umumiy ball 0-100. LLM faqat shu ballarni IZOHLAYDI.
      // Bu usul: subyektiv AI o'rniga aniq, takrorlanadigan, adolatli saralash.
      const scoredUnis = enrichedUnis.map((u: any) => ({
        ...u,
        score: this.computeRecommendationScore(u, preferences, uniMatchedDirs.get(u.id) || []),
      }));
      // Ball bo'yicha saralash (yuqoridan pastga)
      scoredUnis.sort((a: any, b: any) => b.score.total - a.score.total);
      // Qat'iy Top-5 Cutoff
      const top5Recommendations = scoredUnis.slice(0, 5);

      // ===== RECOMMENDATION MEMORY (BOSQICH 9) =====
      if (sessionContext && top5Recommendations.length > 0) {
        // BOSQICH 14: score.reasons/nuances ham saqlanadi — keyin "Nega aynan X?"
        // deb so'ralsa, tushuntirishni qayta hisoblamay, shu sabablardan beramiz.
        sessionContext.lastRecommendations = top5Recommendations.map((u: any) => ({
          id: u.id,
          name: u.fullNameUz || u.fullNameEn || "",
          slug: u.slug || undefined,
          score: u.score
            ? {
                total: u.score.total,
                reasons: Array.isArray(u.score.reasons) ? u.score.reasons : [],
                nuances: Array.isArray(u.score.nuances) ? u.score.nuances : [],
              }
            : undefined,
        }));
        // BOSQICH 11: bestUniversity (eng mos) ni lastUniversity sifatida ham
        // eslab qolamiz — "uning kontrakti qancha?" follow-up'i shu univga bog'lanadi.
        this.rememberUniversity(sessionContext, top5Recommendations[0]);
      }

      return {
        tool: "recommend" as any,
        success: true,
        data: {
          preferences,
          // Fix (ranking): BACKEND qaror qiladi, LLM izohlaydi. Eng yuqori
          // ball olgan universitet — bestUniversity (asosiy javob), qolganlari
          // alternatives ("Keyingi alternativalar").
          bestUniversity: top5Recommendations[0] || null,
          alternatives: top5Recommendations.slice(1),
          recommendations: top5Recommendations,
          directions: matchedDirections.slice(0, 10),
          grants: grants.slice(0, 5),
        },
      };
    } catch (error: any) {
      console.warn("[Recommend Error]", error);
      return this.errorResult("recommend", "Tavsiya ma'lumotlarini olishda xatolik", error);
    }
  }

  /**
   * RECOMMENDATION SCORE V2: backend tomonidan hisoblanadigan universitet balli.
   * LLM tanlamaydi — backend tanlaydi, LLM esa izohlab beradi.
   */
  private computeRecommendationScore(uni: any, preferences: any, matchedDirectionNames: string[] = []): {
    total: number;
    breakdown: { direction: number; budget: number; region: number; bonus: number; weakness: number };
    reasons: string[];
    nuances: string[];
  } {
    let direction = 0;
    let budget = 0;
    let region = 0;
    let bonus = 0;
    let weakness = 0;

    const reasons: string[] = [];
    const nuances: string[] = [];

    // 1. Yo'nalish mosligi (40 bal) — TIERED SEMANTIC MATCHING (Fix: ranking)
    // Ilgari directionCategory bor bo'lsa DOIM 40 ball berilardi — "Atrof-muhit
    // muhandisligi" (generic mos) ham "Data Science" (core mos) bilan teng
    // ball olardi. Endi topilgan yo'nalish nomlari tier bo'yicha baholanadi:
    //   tier1 core (Data Science, AI...) → to'liq 40
    //   tier2 adjacent (Information Systems) → ~26
    //   tier3 loose (Telekom) → ~14
    //   faqat generic → ~6
    if (preferences.directionCategory) {
      // DENSITY (Fix: ranking): "TATU 20 ta IT yo'nalishi" vs "irrigatsiya 2 ta"
      // — ikkalasi ham tier1 (40 ball) olmasligi kerak. Ball = 40 * relevance * density:
      //   TATU (20 strong)  → 40
      //   Transport (3)     → 30
      //   Irrigatsiya (2)   → 20
      const rel = this.computeDirectionRelevance(preferences.directionCategory, matchedDirectionNames);
      direction = Math.round(40 * rel.relevance * rel.density);
      if (matchedDirectionNames.length > 0) {
        const tierLabel = rel.tier === 1 ? "markaziy" : rel.tier === 2 ? "yondosh" : rel.tier === 3 ? "umumiy" : "noaniq";
        const dirDetail = rel.strongCount > 0 ? `${rel.strongCount} ta aniq yo'nalish topildi` : "yo'nalish mavjud";
        reasons.push(`Yo'nalish mosligi: ${tierLabel} darajada, ${dirDetail}`);
        reasons.push(`Topilgan yo'nalishlar: ${matchedDirectionNames.slice(0, 2).join(", ")}`);
      } else {
        reasons.push(`Mo'ljallangan yo'nalish (${preferences.directionCategory}) mavjud`);
      }
    } else {
      direction = 25;
    }

    // 2. Afzal ko'rilgan shahar/region (25 bal)
    if (preferences.preferredCities && preferences.preferredCities.length > 0) {
      const uniLocation = (uni.location || uni.location_uz || uni.fullNameUz || "").toLowerCase();
      const matchedCity = preferences.preferredCities.find((c: string) => uniLocation.includes(c.toLowerCase()));
      if (matchedCity) {
        region = 25;
        reasons.push(`Tanlangan shahar: ${matchedCity.toUpperCase()}`);
      } else {
        region = 5;
        nuances.push(`Universitet ko'rsatilgan afzal shaharlarda (${preferences.preferredCities.join(", ")}) joylashmagan`);
      }
    } else if (preferences.region) {
      const locLower = (uni.location || uni.location_uz || "").toLowerCase();
      const regionName = lookupManager.getRegionName(parseInt(preferences.region), "uz").toLowerCase();
      const base = (s: string) => s.replace(/ (viloyati|shahri|respublikasi)$/i, "").trim();
      if (locLower.includes(base(regionName)) || base(locLower) === base(regionName)) {
        region = 25;
        reasons.push(`Mo'ljallangan hududda (${regionName}) joylashgan`);
      } else {
        region = 10;
      }
    } else {
      region = 15;
    }

    // 3. Byudjet mosligi (20 bal)
    const minFee = uni.minimalTuitionFee ?? uni.minimal_tuition_fee;
    const maxFee = uni.maximalTuitionFee ?? uni.maximal_tuition_fee;
    const midFee = minFee && maxFee ? (minFee + maxFee) / 2 : (minFee || maxFee);

    if (preferences.tuitionMax !== undefined && midFee !== undefined) {
      if (midFee <= preferences.tuitionMax) {
        budget = 20;
        reasons.push(`Kontrakt narxi (${Math.round(midFee / 1_000_000)} mln so'm) byudjetga (${Math.round(preferences.tuitionMax / 1_000_000)} mln) mos`);
      } else {
        const diff = Math.round((midFee - preferences.tuitionMax) / 1_000_000);
        budget = 5;
        nuances.push(`Kontrakt narxi (${Math.round(midFee / 1_000_000)} mln) byudjetdan taxminan ${diff} mln so'm yuqoriroq`);
      }
    } else {
      budget = 12;
    }

    // STAGE 14 — USER STATE (admission_failed): foydalanuvchi imtihondan
    // yiqilgan bo'lsa, XUSUSIY universitetlar ustun chiqadi (davlat emas) —
    // ularning qabuli ochiq, hujjat yig'ish imkoniyati yuqori.
    // MUHIM (user qoidasi): user EXPLICIT davlat/xususiy so'ragan bo'lsa
    // (institutionCategory set), bu bonus qo'llanilmaydi — explicit > inference.
    const uniCat = uni.institutionCategory || (uni.institution_category_id?.toString());
    const hasExplicitCategory = !!(preferences.institutionCategory || preferences.institutionCategories?.length);
    if (preferences.admissionFailed && !hasExplicitCategory) {
      if (uniCat === "4") {
        bonus += 6;
        reasons.push("Imtihondan o'ta olmagan vaziyatda xususiy universitet — qabul imkoniyati yuqori");
      } else if (uniCat === "3") {
        bonus -= 4;
        nuances.push("Davlat universiteti — imtihon talab qilishi mumkin");
      }
    }

    // 4. Bonuslar (15 bal)
    if (preferences.interestGrant && uni.hasGrant) {
      bonus += 5;
      reasons.push("Grant imkoniyati mavjud");
    }
    if (preferences.interestAccommodation && uni.hasAccommodation) {
      bonus += 5;
      reasons.push("Yotoqxona (turar joy) bilan ta'minlaydi");
    } else if (preferences.interestAccommodation && !uni.hasAccommodation) {
      nuances.push("Yotoqxona mavjudligi ko'rsatilmagan");
    }

    if (preferences.wantsInternational && (uni.institutionCategory === "5" || /xalqaro|international|double degree/i.test(uni.fullNameUz || ""))) {
      bonus += 5;
      reasons.push("Xalqaro status / diplom berish imkoniyati yuqori");
    }

    if (preferences.englishLevel && (preferences.englishLevel === "C1" || preferences.englishLevel === "B2")) {
      bonus += 3;
      reasons.push(`Ingliz tili darajangiz (${preferences.englishLevel}) ushbu universitet talablariga mos`);
    }

    // 5. Zaif fan penaltisi (-10 bal)
    if (preferences.weaknesses?.includes("matematika")) {
      const uniName = (uni.fullNameUz || "").toLowerCase();
      if (/kompyuter|dasturlash|injiniring|fizika|matematika|tatu|tuit/i.test(uniName)) {
        weakness = -10;
        nuances.push("Matematika fani yuklamasi yuqori bo'lishi mumkin (matematikangiz zaif bo'lsa qiyinchilik tug'dirishi mumkin)");
      }
    }

    const total = Math.max(0, Math.min(100, direction + budget + region + bonus + weakness));

    return {
      total,
      breakdown: { direction, budget, region, bonus, weakness },
      reasons,
      nuances,
    };
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

      // MUHIM (Fix: turizm): texnikum/kollej/litsey OTM emas — chiqarib tashlanadi
      allUnis = allUnis.filter((u: any) => this.isUniversityLike(u));
      
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
