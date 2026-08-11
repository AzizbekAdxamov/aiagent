/**
 * ENTITY EXTRACTOR — Entity-First arxitektura (BOSQICH 1)
 *
 * IntentClassifier.extractEntities dan mustaqil ishlaydigan kichik modul.
 * Faqat YANGI entity'larni ajratadi:
 *   - tuitionMax / tuitionMin  (byudjet: "20 mln gacha", "15 mln dan yuqori", "$5000")
 *   - faculty                  (fakultet: "stomatologiya fakulteti")
 *   - deadline                 (qabul muddati: "deadline", "hujjat topshirish")
 *   - newsCategory             (yangilik kategoriyasi: "grant yangiliklari")
 *   - hasStipend               (stipendiya: "stipendiyali")
 *
 * Asosiy tamoyil: bu entity'lar TOOL ROUTER'da dynamic filter sifatida
 * ishlatiladi ("Toshkentdagi xususiy tibbiyot universitetlari, 20 mln gacha").
 */

/** USD → so'm taxminiy kurs (faqat $ miqdorlarni so'mga o'tkazish uchun) */
const USD_TO_UZS = 12_800;

export interface BudgetRange {
  tuitionMin?: number;
  tuitionMax?: number;
}

/**
 * Matndagi pul miqdorlarini so'mga aylantiradi.
 * Qo'llab-quvvatlanadigan formatlar:
 *   - "20 mln", "20 million", "20mln", "20 000 000", "20000000"
 *   - "$5000", "5000$"  → so'mga (USD_TO_UZS orqali)
 */
function parseMoney(raw: string): number | null {
  const text = raw.trim().toLowerCase();

  // $ / dollar formatlari
  const usdMatch = text.match(/\$?\s*([\d.,]+)\s*(usd|\$|dollar)?/i);
  const isUsd = /\$|usd|dollar/i.test(text);
  if (isUsd && usdMatch) {
    const val = parseFloat(usdMatch[1].replace(/,/g, "."));
    if (isNaN(val)) return null;
    // MUHIM: vergul minglik ajratgichi bo'lishi mumkin — "$5,000" = 5000 dollar, 5.0 emas!
    // "5,000" da verguldan keyin 3 raqam bo'lsa → minglik ajratgichi (vergullarni olib tashlaymiz)
    if (/,\d{3}(?:\d{3})*(?:\.\d+)?$/.test(usdMatch[1])) {
      const cleaned = usdMatch[1].replace(/,/g, "");
      const asInt = parseInt(cleaned, 10);
      if (!isNaN(asInt)) return asInt * USD_TO_UZS;
    }
    return Math.round(val * USD_TO_UZS);
  }

  // mln / million formatlari: "20.5 mln", "20mln", "30 million"
  const mlnMatch = text.match(/([\d.,]+)\s*(mln|million|milyon|mln\.|млн)/i);
  if (mlnMatch) {
    const val = parseFloat(mlnMatch[1].replace(/,/g, "."));
    if (isNaN(val)) return null;
    return Math.round(val * 1_000_000);
  }

  // Sof raqam: "20 000 000", "20000000", "20.5 mln" (yuqorida), "12000000"
  const digits = text.replace(/[^\d]/g, "");
  if (digits.length >= 5) {
    const val = parseInt(digits, 10);
    if (!isNaN(val)) return val;
  }

  return null;
}

/**
 * Byudjet oralig'ini ajratadi.
 *
 *   "20 mln gacha"          → { tuitionMax: 20000000 }
 *   "15 mln dan yuqori"     → { tuitionMin: 15000000 }
 *   "15 dan 30 mln gacha"   → { tuitionMin: 15000000, tuitionMax: 30000000 }
 *   "arzon universitet"     → {} (tuition_search intent ishlaydi)
 *   "$5000 gacha"           → { tuitionMax: 64000000 }
 */
export function extractBudget(message: string): BudgetRange {
  const lower = message.toLowerCase();
  const result: BudgetRange = {};

  // "X dan Y gacha" — ikki miqdor oralig'i
  // MUHIM: $ belgisi ham capture guruhida bo'lishi kerak, aks holda parseMoney USD'ni ko'rmaydi!
  const rangeMatch = lower.match(/(\$?\s*[\d.,]+\s*(?:mln|million|milyon)?)\s*(?:dan|dan\s+to)\s*(\$?\s*[\d.,]+\s*(?:mln|million|milyon)?)\s*(?:gacha|gachagacha|bo'lgan|gacha\s+bo'lgan)?/i);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    // Birinchi raqamda birlik bo'lmasa, ikkinchisidan meros oladi
    // "15 dan 30 mln gacha" → birinchi "15" ham mln birligida
    let minRaw = rangeMatch[1];
    if (!/(mln|million|milyon)/i.test(minRaw) && /(mln|million|milyon)/i.test(rangeMatch[2])) {
      minRaw = `${minRaw.trim()} mln`;
    }
    const min = parseMoney(minRaw);
    const max = parseMoney(rangeMatch[2]);
    if (min) result.tuitionMin = min;
    if (max) result.tuitionMax = max;
    if (result.tuitionMin || result.tuitionMax) return result;
  }

  // Yuqori chegara: "X gacha", "X dan kam", "X gacha bo'lgan", "X dan oshmagan", "$5000 gacha"
  const maxMatch = lower.match(/(\$?\s*[\d.,]+\s*(?:mln|million|milyon|mln\.)?)\s*(?:gacha|gachagacha|dan\s+kam|gacha\s+bo'lgan|dan\s+oshmagan|dan\s+past|atrofida)/i);
  if (maxMatch) {
    const val = parseMoney(maxMatch[1]);
    if (val) result.tuitionMax = val;
  }

  // Pastki chegara: "X dan yuqori" (raqam OLDIN), "dan yuqori X" (raqam KEYIN), "kamida X"
  const minMatch =
    lower.match(/(\$?\s*[\d.,]+\s*(?:mln|million|milyon|mln\.)?)\s+dan\s+(?:yuqori|ortiq|baland|ko'p)/i)
    || lower.match(/(?:dan\s+(?:yuqori|ortiq|baland|ko'p)|kamida|hech\s+bo'lmaganda)\s*(\$?\s*[\d.,]+\s*(?:mln|million|milyon|mln\.)?)/i);
  if (minMatch) {
    const val = parseMoney(minMatch[1]);
    if (val) result.tuitionMin = val;
  }

  return result;
}

/**
 * Fakultet nomini ajratadi: "stomatologiya fakulteti", "iqtisod fakulteti".
 * Pattern: [soha nomi] fakulteti/fakultetida/fakulteti bor
 */
export function extractFaculty(message: string): string | undefined {
  const match = message.match(/([a-zāōūģķļņŗşž'’\- ]{2,40}?)\s+fakulteti?(da|dagi|ning|ni|ga|da)?\b/i);
  if (!match) return undefined;

  const faculty = match[1]
    .replace(/\b(men|menga|kerak|qanday|bor|haqida|ma'lumot|bormi|top|ko'rsat|universiteti?|oliygoh|institut)\b/gi, "")
    .trim();

  if (faculty.length < 3) return undefined;
  return faculty;
}

/**
 * Qabul muddati (deadline) so'ralganini aniqlaydi.
 * "deadline", "hujjat topshirish muddati", "qabul qachongacha", "oxirgi muddat"
 */
export function extractDeadline(message: string): string | undefined {
  const lower = message.toLowerCase();
  const patterns: RegExp[] = [
    /deadline/i,
    /hujjat\s+topshirish\s+(muddati|oxiri|qachon)/i,
    /qabul\s+(qachongacha|qachon\s+yopiladi|oxirgi\s+kuni|muddati|deadline)/i,
    /oxirgi\s+muddat/i,
    /qachongacha\s+(topshirish|qabul|kirish)/i,
  ];
  if (patterns.some((p) => p.test(lower))) return "deadline";
  return undefined;
}

/**
 * Yangilik kategoriyasini ajratadi: "grant yangiliklari", "sport yangiliklari".
 * `news_search` intenti bilan birgalikda ishlatiladi.
 */
export function extractNewsCategory(message: string): string | undefined {
  const lower = message.toLowerCase();
  if (/grant|stipendiya|scholarship/i.test(lower) && /yangilik|news/i.test(lower)) return "grant";
  if (/sport|futbol|olimpiada/i.test(lower) && /yangilik|news/i.test(lower)) return "sport";
  if (/universitet/i.test(lower) && /yangilik|news/i.test(lower)) return "university";
  if (/qabul|admission/i.test(lower) && /yangilik|news/i.test(lower)) return "admission";
  return undefined;
}

/**
 * Stipendiya so'ralganini aniqlaydi: "stipendiyali", "stipendiya bilan", "stipendiya bormi".
 */
export function extractStipend(message: string): boolean | undefined {
  const lower = message.toLowerCase();
  if (/stipendiya(li|sini|siga| bilan)?|стипендия/i.test(lower)) return true;
  return undefined;
}

/**
 * Kasb/karyera maqsadini ajratadi.
 * "AI yordamida tibbiyotda ishlamoqchiman" → "ai_medicine"
 * "vrach bo'lmoqchiman" → "medicine"
 * "dasturchi bo'lishni xohlayman" → "software_dev"
 */
export function extractCareerGoal(message: string): string | undefined {
  const lower = message.toLowerCase();
  const patterns: [RegExp, string][] = [
    [/\b(ai|sun'?iy intellekt|machine learning)\s+(yordamida|bilan|asosida)?\s*(tibbiyot|meditsina|biologiya)/i, "ai_medicine"],
    [/\b(tibbiy|medical)\s+(ai|sun'?iy intellekt|texnologiya)/i, "ai_medicine"],
    [/\b(bioinformatika|biomedical|tibbiy\s+ai|medical\s+ai)/i, "biomedical"],
    [/\b(vrach|shifokor|doktor)\s+bo'l/i, "medicine"],
    [/\b(dasturchi|programmer|developer)\s+bo'l/i, "software_dev"],
    [/\b(muhandis|engineer)\s+bo'l/i, "engineering"],
    [/\b(huquqshunos|advokat|yurist)\s+bo'l/i, "law"],
    [/\b(o'qituvchi|pedagog|talim)\s+bo'l/i, "education"],
    [/\b(iqtisodchi|moliyachi|banker)\s+bo'l/i, "economics"],
  ];
  for (const [pattern, goal] of patterns) {
    if (pattern.test(lower)) return goal;
  }
  return undefined;
}

/**
 * Ingliz tili darajasini ajratadi.
 * "C1", "IELTS 7", "IELTS 7.0", "B2", "TOEFL 100", "inglizim yaxshi"
 */
export function extractEnglishLevel(message: string): string | undefined {
  // CEFR darajasi: A1, A2, B1, B2, C1, C2
  const cefrMatch = message.match(/\b(A1|A2|B1|B2|C1|C2)\b/i);
  if (cefrMatch) return cefrMatch[1].toUpperCase();

  // IELTS balli: "IELTS 7", "IELTS 7.0", "IELTS 6.5"
  const ieltsMatch = message.match(/\bIELTS\s+(\d+(?:\.\d+)?)\b/i);
  if (ieltsMatch) {
    const score = parseFloat(ieltsMatch[1]);
    if (score >= 7.0) return "C1";
    if (score >= 5.5) return "B2";
    if (score >= 4.0) return "B1";
    return "A2";
  }

  // TOEFL balli
  const toeflMatch = message.match(/\bTOEFL\s+(\d+)\b/i);
  if (toeflMatch) {
    const score = parseInt(toeflMatch[1]);
    if (score >= 95) return "C1";
    if (score >= 72) return "B2";
    return "B1";
  }

  // Ingliz tili holati
  if (/\b(inglizim|ingliz\s+tilim)\s+(yaxshi|zo'r|mukammal|a'lo|kuchli)\b/i.test(message)) return "B2+";
  if (/\b(inglizim|ingliz\s+tilim)\s+(o'rtacha|yomon\s+emas)\b/i.test(message)) return "B1";
  if (/\b(inglizim|ingliz\s+tilim)\s+(zaif|yomon|kam|past|kuchsiz)\b/i.test(message)) return "A2";

  return undefined;
}

/**
 * Afzal ko'rilgan shaharlarni ajratadi (foydalanuvchi qayerda o'qishni xohlaydi).
 * "Toshkent yoki Samarqandni tavsiya qil" → ["toshkent", "samarqand"]
 * "Toshkent yoki Buxoroda o'qishni xohlayman" → ["toshkent", "buxoro"]
 *
 * MUHIM: Bu home region'dan farq qiladi!
 * "Buxoro viloyatidanman, Toshkentda o'qimoqchiman" →
 *   homeRegion: "buxoro", preferredCities: ["toshkent"]
 */
export function extractPreferredCities(message: string): string[] {
  const lower = message.toLowerCase();
  const cities: string[] = [];

  // Shaharlar ro'yxati + pattern (tavsiya/istak kontekstida)
  const CITY_PATTERNS: [RegExp, string][] = [
    [/\btoshkent(?:ga|da|ni|dagi)?\b/i, "toshkent"],
    [/\bsamarqand(?:ga|da|ni|dagi)?\b/i, "samarqand"],
    [/\bbuxoro(?:ga|da|ni|dagi)?\b/i, "buxoro"],
    [/\bandijon(?:ga|da|ni|dagi)?\b/i, "andijon"],
    [/\bfarg'ona(?:ga|da|ni|dagi)?\b/i, "fargona"],
    [/\bnamangan(?:ga|da|ni|dagi)?\b/i, "namangan"],
    [/\bqarshi(?:ga|da|ni|dagi)?\b/i, "qarshi"],
    [/\bnukus(?:ga|da|ni|dagi)?\b/i, "nukus"],
    [/\bnavoiy(?:ga|da|ni|dagi)?\b/i, "navoiy"],
    [/\bjizzax(?:ga|da|ni|dagi)?\b/i, "jizzax"],
  ];

  // Tavsiya / istak ko'rsatuvchi signallar
  const hasPreferenceSignal = /\b(tavsiya|yoki|afzal|istagan|xohlayman|o'qimoqchiman|ko'raman|o'qishni\s+xohlayman|o'qishim\s+kerak|borishni\s+xohlayman)\b/i.test(lower);

  // "shahar1 yoki shahar2" yoki "shahar1 va shahar2" formulasi
  const orPattern = /\b(toshkent|samarqand|buxoro|andijon|farg'ona|namangan|qarshi|nukus|navoiy|jizzax)\b\s+(?:yoki|va|or|and)\s+\b(toshkent|samarqand|buxoro|andijon|farg'ona|namangan|qarshi|nukus|navoiy|jizzax)\b/i;
  const orMatch = lower.match(orPattern);
  if (orMatch) {
    // "X yoki Y" → ikkalasi ham preferred
    const c1 = orMatch[1].toLowerCase().replace("farg'ona", "fargona");
    const c2 = orMatch[2].toLowerCase().replace("farg'ona", "fargona");
    if (!cities.includes(c1)) cities.push(c1);
    if (!cities.includes(c2)) cities.push(c2);
    return cities;
  }

  // Tavsiya signal bo'lganda barcha shaharlarni tekshir
  if (hasPreferenceSignal) {
    for (const [pattern, city] of CITY_PATTERNS) {
      if (pattern.test(lower) && !cities.includes(city)) {
        cities.push(city);
      }
    }
  }

  return cities;
}

/**
 * STAGE 14 — ADMISSION FAILED EXTRACTOR:
 * Foydalanuvchi qabuldan o'ta olmaganini bildiruvchi iboralar aniqlanadi:
 *   "imtihondan yiqildim", "o'qishga kira olmadim", "ballim yetmadi",
 *   "grantga kira olmadim", "qabuldan o'ta olmadim"...
 * Bu context session bo'ylab saqlanadi (recommendationProfile.admissionFailed)
 * va keyingi tavsiyalarda XUSUSIY universitetlar birinchi o'ringa chiqadi.
 *
 * NOTE (STAGE 14c): bu funksiya ENTITY EXTRACTOR'da joylashadi — barcha
 * user-profile extractorlari (careerGoal, budget, weaknesses...) shu modulda
 * yig'ilgan, admissionFailed ham yagona manba shu yerda bo'lishi kerak.
 * follow-up-context.ts undan import qiladi (DRY — kod takrorlanmaydi).
 */
export function extractAdmissionFailed(message: string): boolean {
  if (!message) return false;
  // Apostrof normalizatsiyasi: jingalak (’, ‘) / teskari (`) → to'g'ri (').
  // Real foydalanuvchi "o’qishga kira olmadim" yozadi — regex'lar to'g'ri
  // apostrof bilan, shuning uchun extractor O'ZIDA birlashtiradi. Bu muhim:
  // updateRecommendationProfile RAW matn bilan, isSituationalRecommendation
  // normalize qilingan matn bilan chaqiradi — natija ikkala yo'lda bir xil.
  const m = String(message).replace(/[’‘`]/g, "'");
  return /\b(?:imtihon(?:dan)?\s+(?:yiqildim|y?iqilib|o\'ta\s+olmadim|o\'tolmadim)|o\'qishga\s+(?:kira\s+olmadim|kira\s+olmadim|kirmadim|kirmaganman)|qabul(?:dan)?\s+(?:o\'ta\s+olmadim|o\'tolmadim|yutqazdim)|ball(?:im|im)?\s+(?:yetmadi|yetmayapti|yetmaydi)|grant(?:ga)?\s+(?:kira\s+olmadim|ololmadim|yutolmaganman)|kvota(?:ga)?\s+(?:kira\s+olmadim|tushmadim|olmaganman)|o\'qishga\s+olishmadi|qabul\s+qilmadi|kirmadim\s+o\'qishga|(?:universitet|oliygoh)(?:ga|larga)?\s+kira\s+olmadim|kira\s+olmadim|yiqildim)\b/i.test(m);
}

/**
 * STAGE 14c — WANTS-TO-STUDY EXTRACTOR:
 * Foydalanuvchi o'qishni davom ettirishni xohlayotganini bildiruvchi iboralar:
 *   "o'qimoqchiman", "kirmoqchiman", "topshirmoqchiman", "o'qishni
 *   xohlayman/istayman", "o'rganmoqchiman", "o'qishga kiraman"...
 * admissionFailed bilan birga "imtihondan yiqildim, LEKIN o'qishni xohlayman"
 * vaziyatini to'ldiradi — private-first tavsiya kuchayadi (alternativ yo'l).
 */
export function extractWantsToStudy(message: string): boolean {
  if (!message) return false;
  // Apostrof normalizatsiyasi (extractAdmissionFailed'dagi kabi): jingalak /
  // teskari apostrof → to'g'ri. Qo'ng'iroqchi qaysi yo'ldan kelsa ham bir xil.
  const m = String(message).replace(/[’‘`]/g, "'");
  return /\b(?:o'qimoqchiman|o'qishni\s+(?:xohlayman|istayman|xohlayapman)|kirmoqchiman|kirishni\s+(?:xohlayman|istayman)|topshirmoqchiman|o'rganmoqchiman|o'qishga\s+(?:kira\s+olamanmi|kirsam\s+bo'ladimi|kirishni\s+xohlayman|topshirmoqchi(?:man)?|kirishim\s+kerak)|yana\s+o'qimoqchiman|o'qishni\s+davom\s+ettirmoqchiman)\b/i.test(m);
}

/**
 * Foydalanuvchi niyat flaglarini ajratadi: grant, hostel, xalqaro diplom.
 */
export function extractUserGoalFlags(message: string): {
  wantsGrant?: boolean;
  wantsHostel?: boolean;
  wantsInternational?: boolean;
} {
  const lower = message.toLowerCase();
  return {
    wantsGrant: /\b(grant|stipendiya|scholarship|chegirma|bepul|tekin|pulsiz)\b/i.test(lower) || undefined,
    wantsHostel: /\b(yotoqxona|hostel|turar\s*joy|accommodation|dormitory)\b/i.test(lower) || undefined,
    wantsInternational: /\b(xalqaro diplom|xalqaro sertifikat|international degree|double degree|qo'shma diplom|chet elda tan olinadi|xorijda ishlash)\b/i.test(lower) || undefined,
  };
}

/**
 * Zaif fanlarni ajratadi.
 * "matematikam yaxshi emas", "fizikam zaif", "kimyoni bilmayman"
 */
export function extractWeaknesses(message: string): string[] {
  const weaknesses: string[] = [];
  const lower = message.toLowerCase();

  const WEAK_PATTERNS: [RegExp, string][] = [
    [/\bmatematika(?:m|si|dan)?\s+(?:yaxshi\s+emas|zaif|past|kuchsiz|o'rtacha|yomon|qiyin)\b/i, "matematika"],
    [/\bfizika(?:m|si|dan)?\s+(?:yaxshi\s+emas|zaif|past|kuchsiz|o'rtacha|yomon|qiyin)\b/i, "fizika"],
    [/\bkimyo(?:m|si|dan)?\s+(?:yaxshi\s+emas|zaif|past|kuchsiz|o'rtacha|yomon|qiyin)\b/i, "kimyo"],
    [/\bbun(?:day|dan)\s+(?:kuchsiz|zaif)\b.*matematika/i, "matematika"],
    // "matematikam biroz zaif"
    [/\bmatematika(?:m|si)?\s+(?:biroz|ozgina|unchalik)?\s*(?:zaif|yaxshi\s+emas|past)\b/i, "matematika"],
  ];

  for (const [pattern, subject] of WEAK_PATTERNS) {
    if (pattern.test(lower) && !weaknesses.includes(subject)) {
      weaknesses.push(subject);
    }
  }
  return weaknesses;
}

/**
 * TO'LIQ PROFIL EXTRACTOR — bitta murakkab xabardagi barcha
 * foydalanuvchi ma'lumotlarini bir yerda yig'adi.
 *
 * "Assalomu alaykum, men Buxoro viloyatidanman. Biologiya, kimyo va AIga qiziqaman.
 *  AI yordamida tibbiyotda ishlamoqchiman. Matematikam biroz zaif, inglizim esa C1.
 *  Byudjetim 18 mln atrofida. Toshkent yoki Samarqandni afzal ko'raman.
 *  Grant va yotoqxona bo'lsa yaxshi. Xalqaro diplom ham kerak."
 *
 * → {
 *     careerGoal: "ai_medicine",
 *     englishLevel: "C1",
 *     budget: 18000000,
 *     preferredCities: ["toshkent", "samarqand"],
 *     weaknesses: ["matematika"],
 *     wantsGrant: true,
 *     wantsHostel: true,
 *     wantsInternational: true
 *   }
 */
export interface UserProfile {
  careerGoal?: string;          // "ai_medicine", "medicine", "software_dev"...
  englishLevel?: string;        // "C1", "B2", "IELTS 7.0"
  budget?: number;              // so'm: 18000000
  preferredCities?: string[];   // ["toshkent", "samarqand"]
  weaknesses?: string[];        // ["matematika", "fizika"]
  wantsGrant?: boolean;
  wantsHostel?: boolean;
  wantsInternational?: boolean;
  // STAGE 14/14c — USER STATE: qabuldan o'ta olmagan / o'qishni davom
  // ettirishni xohlaydi. follow-up-context updateRecommendationProfile bu
  // flaglarni recommendationProfile'ga yozadi (xususiy-first tavsiya).
  admissionFailed?: boolean;
  wantsToStudy?: boolean;
}

export function extractUserProfile(message: string): UserProfile {
  const profile: UserProfile = {};

  const careerGoal = extractCareerGoal(message);
  if (careerGoal) profile.careerGoal = careerGoal;

  const englishLevel = extractEnglishLevel(message);
  if (englishLevel) profile.englishLevel = englishLevel;

  const budget = extractBudget(message);
  // "18 mln atrofida" → tuitionMax olishga harakat (atrofida = taxminan)
  if (budget.tuitionMax) profile.budget = budget.tuitionMax;
  else if (budget.tuitionMin) profile.budget = budget.tuitionMin;

  // Sof "X mln" ko'rinishi (gacha/dan yuqori yo'q) → budget sifatida
  if (!profile.budget) {
    const approxMatch = message.match(/(\d+(?:[.,]\d+)?)\s*mln\b/i);
    if (approxMatch) {
      const val = parseFloat(approxMatch[1].replace(',', '.'));
      if (!isNaN(val)) profile.budget = Math.round(val * 1_000_000);
    }
  }

  const preferredCities = extractPreferredCities(message);
  if (preferredCities.length > 0) profile.preferredCities = preferredCities;

  const weaknesses = extractWeaknesses(message);
  if (weaknesses.length > 0) profile.weaknesses = weaknesses;

  const flags = extractUserGoalFlags(message);
  if (flags.wantsGrant) profile.wantsGrant = true;
  if (flags.wantsHostel) profile.wantsHostel = true;
  if (flags.wantsInternational) profile.wantsInternational = true;

  // STAGE 14/14c — USER STATE flaglari (barcha extractorlar bir joyda):
  // "imtihondan yiqildim" → admissionFailed, "o'qimoqchiman" → wantsToStudy
  if (extractAdmissionFailed(message)) profile.admissionFailed = true;
  if (extractWantsToStudy(message)) profile.wantsToStudy = true;

  return profile;
}
