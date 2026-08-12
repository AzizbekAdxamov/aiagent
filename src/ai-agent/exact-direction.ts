/**
 * EXACT DIRECTION RESOLVER (STAGE 14 — Exact Direction Resolution & Strict Data Matching)
 *
 * MUAMMO: "davolash ishiga" degan aniq yo'nalish so'rovi "tibbiyot" kategoriyasi
 * sifatida kengaytirilib, farmatsiya/pediatriya/radiologiya kabi BOShQA
 * yo'nalishlar ham natijaga qo'shilib ketardi.
 *
 * YECHIM: direction_category va exact_direction BUTUNLAY AJRATILADI:
 *
 *   "tibbiyotga qiziqaman"        → category = "tibbiyot"   → kategoriya qidiruvi
 *   "davolash ishiga o'qimoqchiman" → exact = "Davolash ishi" → FAQAT shu yo'nalish
 *   "stomatologiya"               → exact = "Stomatologiya"
 *   "farmatsiya"                  → exact = "Farmatsiya"
 *
 * RULE 1: exact direction topilsa → category search STOP (kengaytirilmaydi)
 * RULE 3: universitet "o'xshash yo'nalish" mavjudligi bilan o'tkazilmaydi —
 *         EXACT nom tekshiriladi (API ma'lumoti hal qiladi, AI taxmin emas).
 */

/** Aniq yo'nalish nomlari (kategoriya terminlari emas — aniq OTM yo'nalishlari) */
export const EXACT_DIRECTION_NAMES: string[] = [
  // 🏥 Tibbiyot
  "davolash ishi",
  "stomatologiya",
  "farmatsiya",
  "pediatriya",
  "jarrohlik",
  "terapiya",
  "akusherlik va ginekologiya",
  "ginekologiya",
  "kardiologiya",
  "neyrologiya",
  "onkologiya",
  "oftalmologiya",
  "dermatologiya",
  "radiologiya",
  "reabilitatsiya",
  "hamshiralik ishi",
  "xamshiralik ishi",
  "tibbiy-biologik ish",
  "tibbiy profilaktika ishi",
  "tibbiyot pedagogikasi",
  "tibbiy biologiya",
  "klinik farmatsiya",
  "epidemiologiya",
  "immunologiya",
  // 💻 IT
  "kompyuter injiniringi",
  "dasturiy injiniring",
  "sun'iy intellekt",
  "data science",
  "kiberxavfsizlik",
  "axborot texnologiyalari",
  "telekommunikatsiya",
  "mobile dasturlash",
  "web dasturlash",
  "raamli iqtisodiyot",
  // 💰 Iqtisod
  "iqtisodiyot",
  "moliya",
  "buxgalteriya hisobi",
  "bank ishi",
  "menejment",
  "marketing",
  "audit",
  "soliq va soliqqa tortish",
  "logistika",
  "tijorat",
  // ⚖️ Huquq
  "yurisprudensiya",
  "huquqshunoslik",
  "xalqaro huquq",
  // 📚 Pedagogika
  "boshlang'ich ta'lim",
  "maktabgacha ta'lim",
  "psixologiya",
  "maxsus pedagogika",
  "defektologiya",
  "jismoniy tarbiya",
  // 🏗 Muhandislik
  "qurilish muhandisligi",
  "arxitektura",
  "energetika",
  "elektr energetikasi",
  "neft va gaz ishi",
  "konchilik ishi",
  "metallurgiya",
  "kimyoviy texnologiya",
  "oziq-ovqat texnologiyasi",
  // 🗣 Filologiya
  "ingliz tili va adabiyoti",
  "rus tili va adabiyoti",
  "o'zbek tili va adabiyoti",
  "tarjima nazariyasi va amaliyoti",
  "jurnalistika",
  // 🎨 San'at
  "dizayn",
  "grafika",
  "musiqa san'ati",
  "kino va televidenie",
  // 🌾 Qishloq xo'jaligi
  "agronomiya",
  "veterinariya",
  "chorvachilik",
  "suv xo'jaligi",
  "mevachilik va sabzavotchilik",
  // 🧳 Turizm
  "turizm",
  "mehmondo'stlik",
  "hotel biznesi",
  // 🏛 Tarix
  "tarix",
  "arxeologiya",
  "sharqshunoslik",
  // ⚽ Sport
  "sport",
  "jismoniy madaniyat",
  "sport menejmenti",
];

/**
 * KASB SO'ZLARI → ANIQ YO'NALISH (STAGE 14d):
 * "doktor bo'lishni xohlayman" → "Davolash ishi" (kategoriya "tibbiyot" EMAS).
 * Aks holda "doktor" → "tibbiyot" kategoriyasiga kengayib, farmatsiya/pediatriya
 * kabi BOShQA yo'nalishlar ham natijaga qo'shilib ketardi (user qoidasi:
 * exact direction topilsa → category search STOP).
 *
 * MUHIM: word-boundary regex — "doktorantura" (doktor+antura) va "doktorlik"
 * (doktor+lik) bularga mos KELMAYDI (akademik daraja ≠ shifokor kasbi).
 */
// Konventsiya: EXACT_DIRECTION_NAMES dagi kabi KICHIK HARF bilan qaytariladi
// (tool-router normalizeDirectionName orqali solishtiradi — holat muhim emas).
const CAREER_TO_EXACT_DIRECTION: Array<{ pattern: RegExp; direction: string }> = [
  { pattern: /\b(doktor|shifokor|vrach|doctor)\b/i, direction: "davolash ishi" },
  { pattern: /\bstomatolog\b/i, direction: "stomatologiya" },
  { pattern: /\bfarmatsevt\b/i, direction: "farmatsiya" },
  { pattern: /\bjarroh\b/i, direction: "jarrohlik" },
  { pattern: /\bhamshira\b/i, direction: "hamshiralik ishi" },
  { pattern: /\bpediatr\b/i, direction: "pediatriya" },
];

/** Matnni taqqoslash uchun normalizatsiya (apostrof, kichik harf, qo'shimcha bo'shliqlar) */
export function normalizeDirectionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-zāōūģķļņŗşž'’0-9\s-]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Foydalanuvchi xabaridan ANIQ yo'nalish nomini ajratib oladi.
 *
 * Qoidalar:
 *  - "davolash ishiga o'qimoqchiman" → "davolash ishi"
 *  - "stomatologiya" → "stomatologiya"
 *  - "tibbiyotga qiziqaman" → null (kategoriya, exact emas)
 *  - "davolash ishi haqida ma'lumot" → "davolash ishi"
 *
 * @returns canonical exact direction nomi yoki null
 */
export function detectExactDirection(message: string): string | null {
  if (!message || message.trim().length < 3) return null;

  const normalized = normalizeDirectionName(message);

  // Avval eng uzun aniq nomni qidirib topamiz (substring bilan)
  let bestMatch: string | null = null;
  let bestLength = 0;
  for (const name of EXACT_DIRECTION_NAMES) {
    const norm = normalizeDirectionName(name);
    if (norm.length <= 2) continue;
    if (normalized.includes(norm)) {
      if (norm.length > bestLength) {
        bestMatch = name;
        bestLength = norm.length;
      }
    }
  }

  if (bestMatch) {
    // Kategoriya umumiy so'zi bilan birga kelsa ham exact ishlaydi
    // ("tibbiyot davolash ishi" → davolash ishi aniqroq)
    return bestMatch;
  }

  // KASB SO'ZI (STAGE 14d): "doktor bo'lishni xohlayman" → "Davolash ishi".
  // GUARD: akademik daraja iboralari bilan birga kelsa qo'llanilmaydi —
  // u yerda "doktor" shifokor kasbi emas, doktoranturani anglatadi.
  const academicDegreeWord =
    /\b(doktorantura|doktoranturada|phd|doctor of science|doctor of philosophy|ilmiy daraja|akademik daraja|doktorlik)\b/i.test(normalized);
  if (!academicDegreeWord) {
    for (const { pattern, direction } of CAREER_TO_EXACT_DIRECTION) {
      if (pattern.test(normalized)) {
        return direction;
      }
    }
  }

  return null;
}

/** Xabarda aniq yo'nalish nomi bormi? */
export function hasExactDirection(message: string): boolean {
  return detectExactDirection(message) !== null;
}
