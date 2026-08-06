/**
 * INTENT CONFIG LOADER (BOSQICH 4 — JSON-driven config)
 *
 * intent-config.json — intent'larning yagona manbai:
 *   - patterns: regex stringlar (\\s, \\b, \\w — JSON'da ikkilangan backslash bilan)
 *   - keywords: oddiy so'zlar → avtomatik \bso'z\b regex'iga aylanadi
 *   - tool: javob formatlash uchun tool nomi
 *   - handler: tool-router'dagi dispatch kaliti
 *   - priority: base confidence
 *   - dataIntent: data bo'lmasa template fallback ishlatiladimi
 *   - responseStrategy: javob qanday yozilishi (template | llm | hybrid)
 *   - selfComplete: follow-up konteksti qo'shilmasinmi (katalog/self-contained)
 *
 * Yangi intent qo'shish uchun kod kerak EMAS — faqat JSON'ga kalit qo'shish
 * yetarli (kalit tartibi = klassifikatsiya tartibi).
 */

import intentConfigJson from "./intent-config.json";

export type ResponseStrategy = "template" | "llm" | "hybrid";

export interface IntentConfigEntry {
  label?: string;
  tool?: string;
  handler?: string;
  priority?: number;
  dataIntent?: boolean;
  /**
   * RESPONSE STRATEGY (BOSQICH 6): javob qanday yaratilishini belgilaydi.
   *   - "template": API ma'lumotlari shablon orqali (LLM chaqirilmaydi, 0 token)
   *   - "llm":      javob LLM orqali yoziladi (reasoning talab qiladi)
   *   - "hybrid":   API ma'lumotlari LLM'ga berilib, tahlil qilingan javob olinadi
   * Eski aiIntent=true → responseStrategy: "llm" ga mos keladi (backward-compatible).
   */
  responseStrategy?: ResponseStrategy;
  /** @deprecated responseStrategy: "llm" ga o'ting — moslash uchun saqlanadi */
  aiIntent?: boolean;
  selfComplete?: boolean;
  patterns?: string[];
  keywords?: string[];
}

/** JSON'ni o'qiydi (kalit tartibi saqlanadi). "_" bilan boshlanuvchi kalitlar metadata. */
export const intentConfig = intentConfigJson as unknown as Record<string, IntentConfigEntry>;

/** Barcha intent nomlari (tartibda) */
export const ALL_INTENTS = Object.keys(intentConfig).filter((k) => !k.startsWith("_"));

/** Regex-special belgilarni escape qiladi (keywords → \b...\b uchun) */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Bitta intent uchun pattern'larni tuzadi: patterns + keywords (ikkalasi ham 'i' flag) */
export function compilePatterns(entry: IntentConfigEntry): RegExp[] {
  const regexes: RegExp[] = [];
  for (const source of entry.patterns || []) {
    try {
      regexes.push(new RegExp(source, "i"));
    } catch (error: any) {
      console.error(`[IntentConfig] Invalid pattern for "${entry.label || "?"}": ${source}`, error?.message);
    }
  }
  for (const keyword of entry.keywords || []) {
    try {
      regexes.push(new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i"));
    } catch (error: any) {
      console.error(`[IntentConfig] Invalid keyword for "${entry.label || "?"}": ${keyword}`, error?.message);
    }
  }
  return regexes;
}

/** Barcha intent'lar uchun tayyor RegExp map (tartibda) — intent-classifier shu yerdan o'qiydi */
export function compileAllIntentPatterns(): Record<string, RegExp[]> {
  const result: Record<string, RegExp[]> = {};
  for (const key of ALL_INTENTS) {
    result[key] = compilePatterns(intentConfig[key]);
  }
  return result;
}

export function getIntentTool(intent: string): string {
  return intentConfig[intent]?.tool || "none";
}

export function getIntentHandler(intent: string): string {
  return intentConfig[intent]?.handler || "none";
}

export function getIntentPriority(intent: string): number {
  return intentConfig[intent]?.priority ?? 0.8;
}

export function getIntentDataFlag(intent: string): boolean {
  return intentConfig[intent]?.dataIntent === true;
}

/**
 * RESPONSE STRATEGY (BOSQICH 6): intent'ning javob strategiyasini qaytaradi.
 *
 * Qaror tartibi:
 *   1. Aniq responseStrategy ko'rsatilgan bo'lsa → o'shani ishlat
 *   2. Eski aiIntent=true → "llm" (backward-compatible)
 *   3. Default → dataIntent bo'lsa "template" (0 token), aks holda "llm"
 *      (faq/unknown/thanks kabi data bo'lmagan intent'lar LLM'ga tushadi)
 *
 * Misol:
 *   - "IT universitetlari"        → university_search → "template" (0 token)
 *   - "TATU va INHA qaysi yaxshi?" → comparison → "llm"
 *   - "matematikam past..."        → recommendation → "llm"
 */
export function getIntentResponseStrategy(intent: string): ResponseStrategy {
  const entry = intentConfig[intent];
  if (entry?.responseStrategy) return entry.responseStrategy;
  if (entry?.aiIntent === true) return "llm";
  return entry?.dataIntent === true ? "template" : "llm";
}

/** @deprecated getIntentResponseStrategy(intent) === "llm" ga o'ting */
export function getIntentAiFlag(intent: string): boolean {
  return getIntentResponseStrategy(intent) === "llm";
}

export function getIntentLabel(intent: string): string {
  return intentConfig[intent]?.label || intent;
}

/** selfComplete=true bo'lgan intent'lar — follow-up konteksti qo'shilmaydi */
export function getSelfCompleteIntents(): string[] {
  return ALL_INTENTS.filter((k) => intentConfig[k]?.selfComplete === true);
}

/** Konfiguratsiyani tekshiradi (pattern compile xatolarini yuzaga chiqaradi) */
export function validateIntentConfig(): { errors: string[] } {
  const errors: string[] = [];
  for (const key of ALL_INTENTS) {
    const entry = intentConfig[key];
    if (!entry) {
      errors.push(`[IntentConfig] Missing entry for "${key}"`);
      continue;
    }
    for (const source of entry.patterns || []) {
      try {
        new RegExp(source, "i");
      } catch (error: any) {
        errors.push(`[IntentConfig] "${key}" (${getIntentLabel(key)}) invalid pattern: ${source} — ${error?.message}`);
      }
    }
    if (!entry.handler) errors.push(`[IntentConfig] "${key}" (${getIntentLabel(key)}) missing handler`);
    if (!entry.tool) errors.push(`[IntentConfig] "${key}" (${getIntentLabel(key)}) missing tool`);
  }
  return { errors };
}

// Modul yuklanganda konfiguratsiyani tekshiramiz — xato pattern darhol ko'rinadi
const validation = validateIntentConfig();
if (validation.errors.length > 0) {
  console.error(validation.errors.join("\n"));
}
