/**
 * QUERY RESOLVER (BOSQICH 14 — Query Resolver qatlami)
 *
 * Intent = "nima qilmoqchi?"
 * Entity = "nima haqida?"
 * Field   = "qaysi ma'lumotni?"
 *
 * Bu modul INTENT dan TASHQARI qatlam: bir xil intent (masalan direction_search)
 * ichida userning asl so'rovi nimani anglatishini aniqlaydi:
 *
 *   "davolash ishi haqida ko'proq ma'lumot bera olasanmi"
 *     → intent: direction_search
 *     → QUERY TYPE: direction_detail   (yo'nalishning O'ZI haqida ma'lumot,
 *                                        universitetlar ro'yxati EMAS!)
 *
 *   "davolash ishi qayerlarda bor"
 *     → intent: direction_search
 *     → QUERY TYPE: direction_search   (yo'nalish bor universitetlar)
 *
 *   "PDP narxi qancha?"
 *     → intent: university_search
 *     → QUERY TYPE: university_field   (faqat kontrakt narxi)
 *
 *   "men doktor bo'lishni orzu qilaman"
 *     → intent: direction_search/recommendation
 *     → QUERY TYPE: direction_search   (lekin Result Validator natijani
 *                                        tibbiyotga mos univlar bilan cheklaydi)
 *
 * Natija provider-manager orqali tool-router va formatter'ga uzatiladi.
 */

import type { IntentResult } from "@/types";
import { detectRequestField } from "./request-field";

export type QueryType =
  | "direction_detail" // Yo'nalishning o'zi haqida ma'lumot (universitet ro'yxati emas)
  | "direction_search" // Yo'nalish bo'yicha universitetlar / katalog
  | "university_detail" // Universitet haqida to'liq/batafsil ma'lumot
  | "university_field" // Universitetning aniq maydoni (narx, telefon, yotoqxona...)
  | "university_search" // Universitetlar katalogi / qidiruv
  | "recommendation" // Shaxsiy tavsiya / maslahat
  | "general_chat" // Umumiy suhbat / maslahat (data kerak emas)
  | "unknown";

export interface ResolvedQuery {
  type: QueryType;
  /** direction_detail: yo'nalish nomi haqida so'ralgan aniq matn (masalan "davolash ishi") */
  directionPhrase?: string;
  /** direction_detail: yo'nalishni ko'rsatishda boshqa universitetlar aralashmasligi */
  detailOnly?: boolean;
}

/** Yo'nalish kategoriya label'lari (formatter'da ko'rsatish uchun) */
export const DIRECTION_CATEGORY_LABELS: Record<string, string> = {
  it: "IT",
  tibbiyot: "Tibbiyot",
  biomedical: "Biotibbiyot / Biomedical",
  iqtisod: "Iqtisod va moliya",
  huquq: "Huquq",
  pedagogika: "Pedagogika",
  muhandislik: "Muhandislik",
  filologiya: "Filologiya (tillar)",
  sanat: "San'at",
  sport: "Sport",
  qishloq: "Qishloq xo'jaligi",
  turizm: "Turizm",
  tarix: "Tarix",
};

/**
 * QUERY TEXT NORMALIZER — apostrof/typo farqlarini yo'qotadi (ikki funksiyada
 * bir xil mantiq takrorlanmasligi uchun umumiy helper).
 */
function normalizeQueryText(message: string): string {
  return message
    .toLowerCase()
    .replace(/[’`]/g, "'")          // jingalak apostrof → to'g'ri apostrof
    .replace(/malumot/gi, "ma'lumot")
    .replace(/koproq/gi, "ko'proq")
    .replace(/yonalish/gi, "yo'nalish")
    .trim();
}

/**
 * "davolash ishi haqida ko'proq ma'lumot", "IT haqida gapirib ber",
 * "tibbiyot yo'nalishi nima?" kabi so'rovlar — yo'nalishning O'ZI haqida
 * ma'lumot so'rovi. Bu university emas, balki DIRECTION DETAIL.
 *
 * Qoida: direction entity (kategoriya sinonimi) + "haqida ma'lumot / batafsil /
 * ko'proq / gapir / tushuntir / nima?" kabi detail iborasi birga kelsa.
 * "davolash ishi qayerlarda bor" → "qayerda" so'zi → detail EMAS (search).
 */
export function isDirectionDetailRequest(message: string, intent: IntentResult): boolean {
  const m = normalizeQueryText(message);
  const hasDirEntity = !!intent.entities?.direction;
  if (!hasDirEntity) return false;

  // Universitet nomi so'ralgan bo'lsa — bu direction detail EMAS.
  // MUHIM: entity extraction regex'ga tushmagan to'liq nomlar ham tekshiriladi
  // ("Toshkent tibbiyot akademiyasi haqida gapirib ber" — "tibbiyot" direction
  // bo'lib qoladi, lekin user UNIVERSITET haqida so'rayapti!).
  if (intent.entities?.university) return false;
  if (/(universitet\w*|university\w*|oliygoh\w*|institut\w*|akademiya\w*|kollej\w*)/i.test(m)) {
    return false;
  }

  // Recommendation signal bo'lsa — "IT haqida ayt, qaysi universitetda o'qish
  // kerak" kabi so'rov direction_detail EMAS (tavsiya kerak).
  if (/\b(qaysi\s+universitet|tanla(?:s|sh)?\b|tavsiya|maslahat|o'qish\s+kerak|o'qimoqchiman|topshirsam)\b/i.test(m)) {
    return false;
  }

  // Detail iboralar: "haqida (ko'proq) ma'lumot", "batafsil ayt", "gapirib ber",
  // "tushuntirib ber", "nima", "qanday ish", "yo'nalishi haqida".
  // MUHIM: apostrofsiz yozuvlar ham qo'shildi ("koproq", "malumot") — real
  // foydalanuvchi apostrof ishlatmaydi, normalizeUserText ham uni tuzatmaydi.
  const detailPhrase =
    /(haqida\s+(?:ko'proq|koproq|ko'p|batafsil)?\s*(ma'lumot|malumot|info|gapir|ayt|tushuntir|ber|bilmoqchiman))|((ko'proq|koproq|batafsil|to'liq|to'liqroq|to'liq\s+ma'lumot)\s+(ma'lumot|malumot|info))|(nima\s+(degani|ekan|deydi|o'zi))|(qanday\s+ish)/i.test(m) ||
    /(yo'nalishi?|sohasi?|kasbi?|fani?)\s+(haqida|nima)\b/i.test(m) ||
    /\b(haqida\s+aytib\s+ber|haqida\s+gapirib\s+ber|tushuntirib\s+ber|tushuntir|aytib\s+ber|gapirib\s+ber)\b/i.test(m);

  if (!detailPhrase) return false;

  // "qayerda bor" / "qaysi universitetda" — search, detail emas
  if (/(qayer(?:da|larda)?|qaer(?:da|larda)?|qaysi\s+universitet|nechta\s+universitet)/i.test(m)) {
    return false;
  }

  // "grant bormi", "kontrakti qancha" kabi FIELD so'rovlari detail emas.
  // MUHIM: faqat UNIVERSITET intent'larida ("yo'nalishi" so'zi university
  // "directions" field'i bo'lishi mumkin — "TATU yo'nalishlari qanday").
  // DIRECTION intent'ida esa "yo'nalishi nima" DETAIL so'rovi (field emas).
  if (intent.intent === "university_search" || intent.intent === "university_detail") {
    const field = detectRequestField(m);
    if (field && field !== "summary") return false;
  }

  return true;
}

/** "davolash ishi" kabi aniq yo'nalish iborasini matndan ajratib oladi */
export function extractDirectionPhrase(message: string, intent: IntentResult): string | undefined {
  const m = normalizeQueryText(message);
  // "X haqida ma'lumot" — X iborasi ("davolash ishi haqida ko'proq ma'lumot" → "davolash ishi")
  const aboutMatch = m.match(/(.+?)\s+haqida\s+(?:ko'proq\s+)?(?:ma'lumot|info|gapir|ayt|tushuntir|ber|bilmoqchiman)\b/i);
  if (aboutMatch && aboutMatch[1]) {
    const phrase = aboutMatch[1]
      .replace(/^(men|menga|menga\s+ber|iltimos|hozir|ana|mana|shu|biz)\s+/i, "")
      .replace(/\s+(yo'nalishi?|sohasi?|kasbi?|fani?|nima)$/i, "")
      .trim();
    if (phrase.length > 1 && !/^(salom|assalomu|hayrli|rahmat)$/i.test(phrase)) {
      return phrase;
    }
  }
  // "tibbiyot yo'nalishi nima" — yo'nalishi nima → oldingi qism
  const dirNima = m.match(/(.+?)\s+(?:yo'nalishi?|sohasi?|kasbi?|fani?)\s+nima\b/i);
  if (dirNima && dirNima[1]) {
    const phrase = dirNima[1].replace(/^(men|shu|bu|ana|mana)\s+/i, "").trim();
    if (phrase.length > 1) return phrase;
  }
  // Kategoriya label'i
  const dir = intent.entities?.direction;
  if (dir) {
    return DIRECTION_CATEGORY_LABELS[dir] || dir;
  }
  return undefined;
}

/**
 * ASOSIY RESOLVER — intent + message + entities asosida query type aniqlaydi.
 *
 * Ustuvorlik:
 *   1. direction_detail (eng aniq — yo'nalishning o'zi haqida)
 *   2. university_field (PDP kontrakti / telefoni)
 *   3. university_detail (PDP haqida batafsil)
 *   4. recommendation (maslahat/tavsiya)
 *   5. general_chat (ruhiy maslahat, umumiy suhbat)
 *   6. qolganlar → intent'ning o'zi
 */
export function resolveQuery(
  message: string,
  intent: IntentResult
): ResolvedQuery {
  // 1. DIRECTION DETAIL — "davolash ishi haqida ma'lumot" (universitet emas!)
  if (isDirectionDetailRequest(message, intent)) {
    return {
      type: "direction_detail",
      directionPhrase: extractDirectionPhrase(message, intent),
      detailOnly: true,
    };
  }

  // 2. UNIVERSITY FIELD — "PDP kontrakti qancha?", "telefoni?"
  if (intent.intent === "university_search" || intent.intent === "university_detail") {
    const field = detectRequestField(message);
    if (field && field !== "summary" && intent.entities?.university) {
      return { type: "university_field" };
    }
    if (intent.intent === "university_detail" || intent.entities?.university) {
      return { type: "university_detail" };
    }
    if (intent.intent === "university_search") {
      return { type: "university_search" };
    }
  }

  // 3. RECOMMENDATION — tavsiya/maslahat
  if (intent.intent === "recommendation") {
    return { type: "recommendation" };
  }

  // 4. GENERAL CHAT — umumiy suhbat
  if (intent.intent === "general_chat" || intent.intent === "greeting" || intent.intent === "faq") {
    return { type: "general_chat" };
  }

  // 5. DIRECTION SEARCH
  if (intent.intent === "direction_search" || intent.intent === "direction_list") {
    return { type: "direction_search" };
  }

  return { type: "unknown" };
}
