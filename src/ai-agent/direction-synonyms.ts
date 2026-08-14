/**
 * Yo'nalish kategoriyalari uchun kengaytirilgan sinonimilar va yordamchi funksiyalar.
 *
 * NEGA KERAK:
 * - "tibbiyotga qiziqaman", "meditsina bo'yicha", "vrach bo'lmoqchiman" kabi
 *   so'rovlarni aniqlash uchun faqat kategoriya nomi emas, barcha sinonimlar
 *   va o'zbekcha kelishik qo'shimchalari bilan moslash kerak.
 * - Ushbu moduldan intent-classifier, provider-manager (follow-up) va
 *   tool-router (search/recommend) birgalikda foydalanadi.
 */

// O'zbekcha so'z oxiriga qo'shiladigan keng tarqalgan qo'shimchalar.
// (ko'plik, kelishik, egalik va shaxs-son qo'shimchalari)
const UZ_SUFFIXES =
  '(?:' +
  'lar(?:imiz|ingiz|i|ini|ida|idan|iga|ining|im)?|' +
  'ning|niki|dagi|dagilari|da|dan|ga|ka|ni|' +
  'imiz|ingiz|larimiz|laringiz|im|ing|i|miz|ngiz|siz|' +
  'li|lik|chilik|chi|shunos|shunoslik|' +
  ')*';

/**
 * So'zni suffix-tolerant regexga aylantiradi.
 * "tibbiyot" → /\btibbiyot(?:lar(?:...)?|ning|da|dan|ga|ni|...)*\b/i
 * Bu "tibbiyot", "tibbiyotga", "tibbiyotda", "tibbiyotlarini" kabi
 * barcha kelishik shakllarini moslaydi.
 */
export function buildSynonymPattern(word: string): RegExp {
  const escaped = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}${UZ_SUFFIXES}\\b`, 'i');
}

/**
 * Barcha yo'nalish kategoriyalari va ularning sinonimilarlari.
 * Kalitlar tool-router dagi CATEGORY_KEYWORDS kalitlariga mos keladi.
 */
export const DIRECTION_SYNONYMS: Record<string, string[]> = {
  it: [
    "it", "dasturlash", "dasturchi", "programmist", "programmer", "developer",
    "kompyuter", "informatika", "axborot texnolog", "kiberxavfsizlik",
    "suniy intellekt", "sun'iy intellekt", "data science", "software", "web", "mobile", "cloud",
    "machine learning", "full stack", "raqamli", "telekommunikatsiya",
    "computer", "dasturiy", "ai", "siber",
  ],
  // YANGI: Biotibbiyot/biomedical — AI+tibbiyot, biologiya injiniringi kabi yo'nalishlar
  // "AI yordamida tibbiyotda ishlamoqchiman" yoki "biologiya+kimyo+AI" kombinatsiyasi shu yerga kiradi
  biomedical: [
    "bioinformatika", "biomedical", "tibbiy ai", "medical ai", "ai meditsina",
    "biologiya injiniringi", "bioinjenering", "genomika", "biofizika",
    "computational biology", "health informatics", "bioximiya injiniring",
    "tibbiy texnologiya", "medical technology", "tibbiy informatika",
    "farmakoinformatika", "biogen",
  ],
  tibbiyot: [
    "tibbiyot", "tibbiy", "meditsina", "medicina", "medical", "vrach", "shifokor",
    "doktor", "farmatsiya", "farmatsevt", "farmakologiya", "davolash",
    "davolovchi", "klinik", "stomatolog", "stomatologiya", "terapevt", "pediatr", "jarroh",
    "jarrohlik", "hamshira", "xamshira", "xamshiralik", "sogliqni saqlash",
    "salomatlik", "sog'lomlashtirish", "kardiolog", "neyrolog", "onkolog",
    "ginekolog", "akusher", "travmatolog", "oftalmolog", "dermatolog",
    "radiolog", "reabilitatsiya", "sanitariya", "epidemiolog", "immunolog",
    "pediatriya", "anesteziolog", "biologiya", "genetika", "anatomiya",
    "fiziologiya", "dentistry", "nurse", "lor",
  ],
  iqtisod: [
    "iqtisod", "iqtisodiy", "iqtisodiyot", "iqtisodchi", "iqtisodchiman", "iqtisodchi bo'lmoq", "ekonomika", "economics", "moliya", "moliyaviy",
    "finance", "buxgalter", "buxgalteriya", "bank", "bank ishi", "menejment",
    "management", "marketing", "logistika", "audit", "auditor", "soliq",
    "kredit", "investitsiya", "tijorat", "savdo", "business", "biznes",
    "startap", "tadbirkor", "konsalting", "reklama", "sotuv", "iqtsod",
  ],
  huquq: [
    "huquq", "huquqiy", "yuridik", "yurisprudensiya", "advokat", "sud",
    "sudya", "law", "legal", "prokuratura", "prokuror", "notarius",
    "huquqshunos", "jinoyat", "fuqarolik", "konstitutsiya", "xalqaro huquq",
    "yurist",
  ],
  pedagogika: [
    "pedagogika", "pedagog", "talim", "ta'lim", "talimiy", "okituvchi",
    "o'qituvchi", "ustoz", "maktab", "maktabgacha", "psixolog", "psixologiya",
    "defektolog", "logoped", "metodika", "boshlangich", "jismoniy talim",
    "jismoniy ta'lim", "kasb talimi", "kasb ta'limi", "education", "teacher",
    "tarbiyachi",
  ],
  muhandislik: [
    "muhandis", "muhandislik", "engineering", "qurilish", "arxitektura",
    "energetika", "elektr", "elektrotexnika", "mexanika", "ishlab chiqarish",
    "avtomatlashtirish", "robototexnika", "robot", "materialshunoslik",
    "neft", "gaz", "konchilik", "metallurgiya", "geologiya", "quruvchi",
    "injinering", "injiniring", "texnika", "matematika", "matematik",
    "fizika", "fizik", "fizika-matematika", "astrofizika", "mexatronika",
    "kimyo", "kimyoviy", "biokimyo", "kimyo-texnologiya", "neft kimyosi",
  ],
  tarix: [
    "tarix", "tarixchi", "tarixiy", "arxeologiya", "arxeolog",
    "tarixshunos", "tarixshunoslik", "etnografiya", "etnograf",
    "manbashunoslik", "umumiy tarix", "jahon tarixi", "vatan tarixi",
    "history", "archeology", "source studies", "falsafa", "falsafiy",
  ],
  filologiya: [
    "filologiya", "tilshunos", "tilshunoslik", "lingvistika", "tarjimon",
    "tarjima", "chet tili", "ingliz tili", "rus tili", "nemis tili",
    "fransuz tili", "xitoy tili", "arab tili", "koreys tili", "yapon tili",
    "turk tili", "adabiyot", "jurnalistika", "muharrir", "yozuvchi",
    "literature", "language", "filolog",
  ],
  sanat: [
    "sanat", "san'at", "dizayn", "design", "moda", "rassom", "rassomlik",
    "musiqa", "madaniyat", "kino", "teatr", "xoreografiya", "raqs",
    "tasviriy", "amaliy", "grafika", "haykaltaroshlik", "foto", "video",
    "animatsiya", "aktyor", "artist", "qoshiqchi",
  ],
  sport: [
    "sport", "jismoniy tarbiya", "fizkultura", "trener", "futbol", "kurash",
    "bokschi", "suzish", "gimnastika", "olimpiya", "sport menedjment",
    "sog'lomlashtirish", "atletika", "karate", "taekvondo", "boks",
  ],
  qishloq: [
    "qishloq", "qishloq xojaligi", "qishloq xo'jaligi", "qishloq xujaligi",
    "dehqon", "dehqonchilik", "agrar", "agronom", "agronomiya", "veterinar",
    "veterinariya", "chorvachilik", "oziq-ovqat", "paxtachilik",
    "sabzavotchilik", "mevachilik", "ekologiya", "atrof-muhit",
    "suv xojaligi", "suv xo'jaligi", "melioratsiya", "o'rmon",
    "baliqchilik", "tabiat", "ovqatlanish",
  ],
  turizm: [
    "turizm", "mehmondo'stlik", "hotel", "mehmonxona", "restoran", "sayohat",
    "xizmat kursatish", "ovqatlanish", "hospitality", "turist", "gid",
  ],
};

/**
 * Matnda biror yo'nalish kategoriyasining sinonimi bor-yo'qligini aniqlaydi.
 * Misol: "tibbiyotga qiziqaman" → "tibbiyot"
 *         "meditsina bo'yicha"  → "tibbiyot"
 *         "IT ni yaxshi ko'raman" → "it"
 */
/**
 * Matnda AI + tibbiyot/biologiya/kimyo birgalikda kelganmi?
 * Agar ha — biomedical yo'nalishi ehtimoli yuqori.
 */
export function isAiBiomedicalContext(message: string): boolean {
  const lower = message.toLowerCase();
  const hasAI = /\b(ai|sun'?iy intellekt|machine learning|data science)\b/i.test(lower);
  const hasBioMed = /\b(tibbiyot|meditsina|biologiya|kimyo|biolog|vrach|shifokor|farmatsiya|genetika)\b/i.test(lower);
  return hasAI && hasBioMed;
}

/**
 * STAGE 19 (adversarial): sinonimiya mention'i NEGATIV ekanini aniqlaydi.
 * "IT emas" / "tibbiyot kerak emas" / "iqtisodga qiziqmayman" — negativ
 * fe'l sinonimiya so'zidan keyin kelsa, bu kategoriya EMAS (user rad etmoqda).
 * "IT ga qiziqaman" (ijobiy) esa kategoriya sifatida qoladi.
 */
function isSynonymNegated(message: string, syn: string): boolean {
  const escaped = syn.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${escaped}${UZ_SUFFIXES}\\b`, 'i');
  const m = message.match(re);
  if (!m || m.index === undefined) return false;
  const after = message.slice(m.index + m[0].length, m.index + m[0].length + 45);
  return /^\s*(?:emas|qiziqmayman|qiziqtirmaydi|yoqtirmayman|yoqmaydi|xohlamayman|istamayman|bo'lmasin|kerak\s+emas|shart\s+emas|keragi\s+yo'q)/i.test(after);
}

export function detectDirectionCategory(message: string): string | null {
  if (!message) return null;
  const lower = message.toLowerCase();

  // MUHIM: AI + tibbiyot/biologiya/kimyo kombinatsiyasi → biomedical (IT emas!)
  // "AI yordamida tibbiyotda ishlamoqchiman", "biologiya, kimyo va AI" → biomedical
  if (isAiBiomedicalContext(lower)) {
    return 'biomedical';
  }

  for (const [category, synonyms] of Object.entries(DIRECTION_SYNONYMS)) {
    for (const syn of synonyms) {
      if (buildSynonymPattern(syn).test(lower) && !isSynonymNegated(lower, syn)) return category;
    }
  }
  return null;
}

/**
 * CONFIDENCE SCORE (BOSQICH 7) — yo'nalish aniqlashda ishonch bali.
 *
 * "tibbiyot" (aniq so'z) → 0.92
 * "tibbiyotga" (kelishik) → 0.87
 * "Tibiyot" (typo) → 0.75 (normalizer tuzatadi, lekin ishonch past)
 *
 * Past ishonch (< 0.7) → agent aniqlashtiruvchi savol so'raydi:
 * "«X» yo'nalishini nazarda tutdingizmi?"
 */
export function detectDirectionWithConfidence(message: string): { category: string; confidence: number } | null {
  if (!message) return null;
  const lower = message.toLowerCase();

  for (const [category, synonyms] of Object.entries(DIRECTION_SYNONYMS)) {
    for (const syn of synonyms) {
      if (buildSynonymPattern(syn).test(lower)) {
        // Aniq so'z (kelishiksiz) → yuqori ishonch
        const exactWord = new RegExp(`\\b${syn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
        if (exactWord.test(lower)) {
          return { category, confidence: 0.92 };
        }
        // Kelishik/ko'plik shakli → biroz past
        return { category, confidence: 0.87 };
      }
    }
  }
  return null;
}

/** Follow-up kontekstida yo'nalish eslatib o'tilganmi? */
export function hasDirectionMention(message: string): boolean {
  return detectDirectionCategory(message) !== null;
}

/**
 * Qiziqish / istak bildiruvchi so'zlar.
 * "tibbiyotga qiziqaman", "vrach bo'lmoqchiman", "IT ni yaxshi ko'raman"
 * kabi so'rovlarda direction_search intentini tasdiqlaydi.
 */
export const INTEREST_PHRASES: string[] = [
  "qiziqaman", "qiziqasan", "qiziqadi", "qiziqtiradi", "qiziqtiryapti", "qiziq", "qiziqish",
  "yaxshi ko'raman", "yaxshi koraman", "yoqadi", "yoqar",
  "bo'lmoqchiman", "bo'lishni xohlayman", "bo'lishni istayman", "bo'laman",
  "o'qimoqchiman", "o'qishni xohlayman", "o'qishni istayman", "o'rganmoqchiman",
  "o'rganishni xohlayman", "ishlamoqchiman", "ishlashni xohlayman",
  "xohlayman", "istayman", "orzuim", "maqsadim", "shug'ullanaman",
  "shug'ullanmoqchiman", "aloqador", "bog'liq",
  "kirmoqchiman", "kirmoqchi", "kirmoqchiman", "kirishim", "kirishni xohlayman",
  "topshirmoqchiman", "topshirmoqchi",
];

/** Matnda qiziqish / istak so'zi bor-yo'qligini aniqlaydi. */
export function hasInterestPhrase(message: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return INTEREST_PHRASES.some((p) => buildSynonymPattern(p).test(lower));
}

/**
 * Follow-up mavzusi sifatida saqlanmasligi kerak bo'lgan umumiy sarlavhalar.
 * "### 🎯 Sizga eng yaxshi variantni topaman!" kabi shablon sarlavhalari
 * mavzu nomi bo'lib qolib, keyingi so'rovlarni buzmasligi uchun filter qilinadi.
 */
export const GENERIC_TOPIC_HEADING =
  /^(sizga|siz uchun|mana|kechirasiz|tushunaman|assalomu|salom|universitetlar|o'zbekistondagi|yo'nalishlar|grantlar|yangiliklar|so'nggi|taqqoslash|javob|rahmat|qiziq|sizga mos|topildi|topilmadi|qanday yo'nalishlar|qanday universitetlar|qanday grantlar|qanday yangiliklar|kontrakt narx(?:lari|i|lar)?|eng arzon|\d|\d+\s*milliongacha kontrakti|kontrakti bor|milliongacha kontrakti)/i;
