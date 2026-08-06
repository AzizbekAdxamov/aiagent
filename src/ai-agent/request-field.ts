/**
 * REQUEST FIELD DETECTOR (BOSQICH 12 — Response Composer)
 *
 * Foydalanuvchi universitetning ANIQ MAYDONI haqida so'raganda:
 *   "telefoni"   → phone
 *   "narxlari"   → tuition
 *   "yotoqxonasi"→ hostel
 *   "granti"     → grant
 *   "qabuli"     → admission
 *   "sayti"      → website
 *   "manzili"    → address
 *   "haqida"     → summary (to'liq karta)
 *
 * Bu INTENT emas — university_lookup ichidagi FIELD REQUEST. Intent bitta
 * qoladi (university_search), Response Composer esa request type bo'yicha
 * faqat o'sha maydonni chiqaradi ("PDP telefoni?" → faqat telefon, to'liq
 * karta emas).
 *
 * Muhim: KO'PLIK shakllari ("grantlar", "kontraktlar", "narxlar") field emas
 * — ular umumiy katalog so'rovi (grant_list / tuition_search). Faqat
 * EGALIK/ko'plik-egalik shakllari ("granti", "kontrakti", "narxlari") field
 * hisoblanadi — ular ma'lum bir universitеtga ishora qiladi.
 */

export type RequestField =
  | "phone"
  | "tuition"
  | "hostel"
  | "grant"
  | "admission"
  | "website"
  | "email"
  | "address"
  | "directions"
  | "summary"
  | null;

/** Barcha field so'zlarini (egalik/ko'plik-egalik shakllari) aniqlash. */
const FIELD_PATTERNS: Array<{ field: Exclude<RequestField, null>; pattern: RegExp }> = [
  // DIQQAT: tartib muhim — "narx" "narxi" dan oldin tekshirilmaydi (regex
  // alternation o'zi eng uzun moslikni topadi). Ko'plik shakllari ("grantlar",
  // "kontraktlar") EMAS — ular umumiy katalog.
  {
    field: "directions",
    pattern: /\b(yo'nalishlari|yo'nalishi|fakultetlari|fakulteti|dasturlari|dasturi)\b/i,
  },
  {
    field: "phone",
    pattern: /\b(telefonlari|telefoni|telefon|raqamlari|raqami|raqam|nomeri|nomer|tel\.?)\b/i,
  },
  {
    field: "tuition",
    pattern: /\b(kontraktlari|kontrakti|kontrakt|narxlari|narhlari|narxi|narhi|narx|narh|to'lovlari|to'lovi|to'lov|tuition|price)\b/i,
  },
  {
    field: "hostel",
    pattern: /\b(yotoqxonalari|yotoqxonasi|yotoqxona|hostel|dormitory)\b/i,
  },
  {
    field: "grant",
    pattern: /\b(stipendiyalari|stipendiyasi|stipendiya|grantlari|granti|grant|scholarship)\b/i,
  },
  {
    field: "admission",
    pattern: /\b(qabullari|qabuli|qabul|kirish|ochilganmi|ochilgan|ochiqmi|ochiq|yopiqmi|yopiq|deadline|muddati|muddat)\b/i,
  },
  {
    field: "website",
    pattern: /\b(saytlari|sayti|sayt|site|web|linklari|linki|link)\b/i,
  },
  {
    field: "email",
    pattern: /\b(electronic\s+pochta|elektron\s+pochta|elektron\s+pochta(si)?|pochta(si)?|email|e-mail)\b/i,
  },
  {
    field: "address",
    pattern: /\b(manzillari|manzili|manzil|qayerda|qaerda|address)\b/i,
  },
];

/**
 * Xabardagi so'ralgan maydonni aniqlaydi.
 * "uning narxlari qancha" → "tuition", "PDP telefoni" → "phone",
 * "haqida ma'lumot ber" → "summary".
 * Topilmasa / ko'plik umumiy so'z bo'lsa → null.
 */
export function detectRequestField(message: string): RequestField {
  const m = message.trim();
  if (!m) return null;

  // Summary — "haqida / ma'lumot / batafsil / info" — to'liq karta so'rovi.
  // MUHIM: "yo'nalishlari haqida" — directions field "yo'nalishlari" ni ham
  // o'z ichiga oladi; summary birinchi tekshiriladi, lekin "yo'nalishlari"
  // so'zi bo'lsa directions ustun bo'lishi kerak.
  const hasDirectionsWord = /\b(yo'nalishlari|yo'nalishi|fakultetlari|dasturlari)\b/i.test(m);
  if (!hasDirectionsWord && /\b(haqida|ma'lumot|batafsil|to'liq|info|o'rgan|qarab ber)\b/i.test(m)) {
    return "summary";
  }

  for (const { field, pattern } of FIELD_PATTERNS) {
    if (pattern.test(m)) return field;
  }
  return null;
}

/**
 * BARE FIELD REQUEST — xabar FAQAT field so'zidan iborat bo'lsa (universitet
 * nomi, region, yo'nalish YO'Q):
 *   "kontrakti qancha", "telefoni", "narxlari" → true
 *   "PDP kontrakti", "Toshkentdagi kontrakti"  → false (kontekst bor)
 *
 * Bunday so'rovda lastUniversity bo'lmasa, tool TAXMIN QILMASLIGI kerak —
 * agent "Qaysi universitet nazarda tutilgan?" deb so'raydi (user qoidasi 8).
 */
export function isBareFieldRequest(message: string): boolean {
  const m = message.trim();
  if (!m || m.split(/\s+/).length > 5) return false;

  const field = detectRequestField(m);
  if (!field || field === "summary") return false;

  // Universitet so'zi bo'lsa — aniq kontekst ("PDP University kontrakti")
  if (/\b(universitet|oliygoh|institut|akademiya|university|college|oliygohi?|instituti?)\w*\b/i.test(m)) {
    return false;
  }

  // Field so'zlari + savol so'zlarini olib tashlab, qolgan qism deyarli bo'sh
  // bo'lishi kerak (faqat field so'zi + savol belgilari). BARCHA field
  // patternlarini olib tashlaymiz — "kontrakti qancha" → leftovers bo'sh.
  const leftovers = m
    .replace(/[?.!,:;]+/g, " ")
    .replace(/\b(qancha|necha|bormi|bormikan|bormikin|bor|qanday|ochilganmi|ochiqmi|yopiqmi|nima|qanaqa|uning|shu|o'sha|ana\s+shu|o'shaniki|buning|bularning|ularning|u|haqida|batafsil|yoki)\b/gi, " ")
    // Barcha field so'zlarini (egalik/ko'plik-egalik shakllari) olib tashlash
    .replace(/\b(yo'nalishlari|yo'nalishi|fakultetlari|fakulteti|dasturlari|dasturi|telefonlari|telefoni|telefon|raqamlari|raqami|raqam|nomeri|nomer|kontraktlari|kontrakti|kontrakt|narxlari|narhlari|narxi|narhi|narx|narh|to'lovlari|to'lovi|to'lov|tuition|price|yotoqxonalari|yotoqxonasi|yotoqxona|hostel|dormitory|stipendiyalari|stipendiyasi|stipendiya|grantlari|granti|grant|scholarship|qabullari|qabuli|qabul|kirish|ochilganmi|ochilgan|ochiqmi|ochiq|yopiqmi|yopiq|deadline|muddati|muddat|saytlari|sayti|sayt|site|web|linklari|linki|link|manzillari|manzili|manzil|qayerda|qaerda|address)\b/gi, " ")
    .replace(/[^a-zāōūģķļņŗşž'’\s-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return leftovers.length <= 1;
}

/** Field → o'zbekcha label (clarification savolida ishlatiladi) */
export function requestFieldLabel(field: RequestField): string {
  switch (field) {
    case "phone": return "telefon raqami";
    case "tuition": return "kontrakt narxi";
    case "hostel": return "yotoqxona";
    case "grant": return "grant";
    case "admission": return "qabul holati";
    case "website": return "sayt";
    case "email": return "elektron pochta";
    case "address": return "manzil";
    case "directions": return "yo'nalishlar";
    default: return "ma'lumot";
  }
}
