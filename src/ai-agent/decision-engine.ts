/**
 * DECISION ENGINE (STAGE 15f) — confidence + clarification qaror qatlami.
 *
 * IntentResult.confidence mavjud, lekin hech qayerda ishlatilmayotgandi.
 * Bu qatlam yakuniy qarorni (direct / clarify / conversational) DETERMINISTIK
 * hisoblaydi — LLM emas, kod. Maqsad:
 *
 *   - Yetarli ma'lumot bor (yo'nalish + shahar) → DIRECT (to'g'ridan-to'g'ri tavsiya)
 *   - Muhim ma'lumot yetishmayapti → CLARIFY (aniqlashtiruvchi savol, 46 ta
 *     universitеtni toolga yuborishdan oldin)
 *   - Suhbat/maslahat intent (general_chat, faq...) → CONVERSATIONAL (tool YO'Q)
 *
 * Confidence = intentConfidence + ma'lumot to'liqligi (direction/region/budget).
 * User qoidasi (STAGE 15f): "Qaysi universitetni tavsiya qilasan?" → toolga
 * darhol universitеtlar yuborilmaydi — avval aniqlashtirish. Lekin
 * "yiqildim + IT + Toshkent" → barcha ma'lumot bor → direct.
 */

export type DecisionMode = "direct" | "clarify" | "conversational";

export interface RecommendationDecision {
  mode: DecisionMode;
  confidence: number;
  missing: string[];
  needsTool: boolean;
  /** "bilmadim" + yo'nalish noaniq → yo'nalishlar ro'yxati taklif qilinadi */
  cantAnswer?: boolean;
  /** Nima uchun shu qaror chiqqani (debug/test uchun) */
  reason: string;
}

/** Tool chaqirilmaydigan suhbat intentlari */
export const CONVERSATIONAL_INTENTS = new Set([
  "general_chat",
  "faq",
  "greeting",
  "thanks",
  "unknown",
]);

/** "Bilmadim" iboralari — user yo'nalish ham bilmaydi → yo'nalishlar taklifi */
const NO_ANSWER_PHRASES =
  /\b(bilmadim|bilmayman|bilmayapman|bilolmayman|bilmasam|bilmiman|bilmam|bilmammi|bilmaymanmi|tanlovim yo'q|xohlamayman|nimani tanlashni bilmayman|o'zim bilmayman|nima bilay)\b/i;

export interface DecisionFacts {
  direction?: string;
  region?: string;
  budget?: number;
}

/**
 * Entity'lar + recommendationProfile'dan qaror uchun faktlarni ajratadi.
 * profile memory ma'lumotini ham hisobga oladi (multi-turn!).
 *
 * Profilning H A Q I Q I Y shakli (types/index.ts): interests[], city,
 * budget, preferredCities[] — directionCategory/region EMAS!
 */
export function deriveDecisionFacts(
  entities: Record<string, any> = {},
  profile: {
    directionCategory?: string;
    region?: string;
    city?: string;
    interests?: string[];
    preferredCities?: string[];
    budget?: number;
  } = {}
): DecisionFacts {
  return {
    direction:
      entities.direction || profile.directionCategory || (profile.interests && profile.interests.length > 0 ? profile.interests[0] : undefined),
    region:
      entities.region ||
      profile.region ||
      profile.city ||
      (entities.preferredCities?.length ? entities.preferredCities[0] : undefined) ||
      (profile.preferredCities?.length ? profile.preferredCities[0] : undefined),
    budget: entities.tuitionMax ?? profile.budget,
  };
}

/**
 * Yakuniy qarorni hisoblaydi. PURE — hech qanday side effect yo'q,
 * regression testlarda to'g'ridan-to'g'ri ishlatiladi.
 *
 * Threshold'lar (user qoidasi):
 *   missing == 0                          → direct (to'liq ma'lumot)
 *   missing > 0, "bilmadim" + no direction → clarify (yo'nalishlar taklifi)
 *   missing > 0, confidence < 0.6          → clarify (ishonch past)
 *   missing > 0                            → clarify (bitta-bitta so'rash)
 *   suhbat intent                          → conversational (tool yo'q)
 */
export function computeRecommendationDecision(params: {
  intent: string;
  intentConfidence?: number;
  direction?: string;
  region?: string;
  budget?: number;
  message?: string;
}): RecommendationDecision {
  const intent = params.intent;
  const intentConfidence = params.intentConfidence ?? 0.85;
  const message = (params.message || "").toLowerCase();

  // 1) Suhbat intentlari — tool umuman chaqirilmaydi
  if (CONVERSATIONAL_INTENTS.has(intent)) {
    return {
      mode: "conversational",
      confidence: intentConfidence,
      missing: [],
      needsTool: false,
      reason: `${intent} — suhbat/maslahat, tool kerak emas`,
    };
  }

  // 2) Recommendation (va recommendation-like) intentlar
  const direction = params.direction;
  const region = params.region;
  const budget = params.budget;

  const missing: string[] = [];
  if (!direction) missing.push("directionCategory");
  if (!region) missing.push("region");

  // Ma'lumot to'liqligi → confidence'ga ta'sir
  const knownCount = [direction, region, budget].filter(Boolean).length;
  let confidence = intentConfidence;
  if (knownCount === 0) confidence = Math.max(0.3, intentConfidence - 0.25);
  else if (knownCount === 1) confidence = Math.max(0.4, intentConfidence - 0.1);
  else confidence = Math.min(0.98, intentConfidence + 0.05);

  if (missing.length === 0) {
    return {
      mode: "direct",
      confidence,
      missing: [],
      needsTool: true,
      reason: "Barcha muhim ma'lumot bor — to'g'ridan-to'g'ri tavsiya",
    };
  }

  // "bilmadim" + yo'nalish ham noaniq → yo'nalishlar ro'yxati taklifi
  // (cheksiz savol so'ralmaydi — Fix 16 qoidasi decision qatlamiga ko'chirildi)
  if (NO_ANSWER_PHRASES.test(message) && !direction) {
    return {
      mode: "clarify",
      confidence,
      missing,
      needsTool: true,
      cantAnswer: true,
      reason: "'bilmadim' — yo'nalishlar ro'yxati taklif qilinadi",
    };
  }

  if (confidence < 0.6) {
    return {
      mode: "clarify",
      confidence,
      missing,
      needsTool: true,
      reason: `Ishonch past (${confidence.toFixed(2)}) — aniqlashtirish kerak`,
    };
  }

  return {
    mode: "clarify",
    confidence,
    missing,
    needsTool: true,
    reason: `Yetishmayotgan ma'lumot: ${missing.join(", ")}`,
  };
}
