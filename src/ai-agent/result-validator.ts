/**
 * RESULT VALIDATOR (STAGE 16) — tool qaytargan natijani policy'ga tekshiradi.
 *
 * Maqsad: LLM hech qachon business rule'ni buzolmasligi uchun kod qatlamida
 * natija AУДIT qilinadi. Har bir kandidat uchun:
 *
 *   REJECT   — qat'iy buzilish (budget oshdi, kategoriya taqiqlangan,
 *              takroriy nom, nomi yo'q) → natijadan CHIQARILADI
 *   DOWNRANK — yumshoq siyosat (yiqilgan user uchun davlat, shahar mos emas,
 *              yo'nalish mos emas) → ro'yxatda pastroqda turadi (scoring)
 *   ACCEPT   — mos
 *
 * PURE funksiya — hech qanday API chaqirmaydi, regression testlarda
 * to'g'ridan-to'g'ri ishlatiladi. applyHardBudgetFilter bilan bir xil budget
 * qoidasini ishlatadi (bitta manba emas — ikki joyda himoya).
 */

export type ValidationVerdict = "accept" | "reject" | "downrank";

export interface ValidatedCandidate {
  name: string;
  verdict: ValidationVerdict;
  /** Nega shu hukm chiqqani (LLM tushuntirishi uchun) */
  reasons: string[];
}

export interface ValidationInput {
  name?: string;
  institutionCategoryId?: number | string | null;
  institutionCategory?: string;
  minimalTuitionFee?: number | null;
  maximalTuitionFee?: number | null;
  location?: string;
  /** Yo'nalish mosliklari soni (0 = mos yo'q) */
  matchedDirections?: string[];
}

export interface ValidationPreferences {
  tuitionMax?: number;
  tuitionMin?: number;
  directionCategory?: string;
  region?: string;
  preferredCities?: string[];
  institutionCategory?: string;
  institutionCategories?: string[];
  admissionFailed?: boolean;
}

export interface RecommendationValidation {
  accepted: ValidatedCandidate[];
  rejected: ValidatedCandidate[];
  downranked: ValidatedCandidate[];
  /** Qo'llanilgan qat'iy qoidalar (LLM kontrakti uchun) */
  constraintsApplied: string[];
}

/** Lokal kategoriya klassifikatsiyasi (tool-router'dan import qilinsa circular bo'ladi) */
function categoryRank(uni: ValidationInput): "private" | "international" | "state" | "other" {
  const catName = (uni.institutionCategory || "").toLowerCase();
  const catId = String(uni.institutionCategoryId ?? "");
  if (catId === "4" || /xususiy/.test(catName)) return "private";
  if (catId === "5" || /xalqaro/.test(catName)) return "international";
  if (catId === "3" || /davlat/.test(catName)) return "state";
  return "other";
}

export function validateRecommendationResults(
  candidates: ValidationInput[],
  preferences: ValidationPreferences
): RecommendationValidation {
  const constraintsApplied: string[] = [];
  const accepted: ValidatedCandidate[] = [];
  const rejected: ValidatedCandidate[] = [];
  const downranked: ValidatedCandidate[] = [];

  if (preferences.tuitionMax !== undefined) constraintsApplied.push(`budget: max ${Math.round(preferences.tuitionMax / 1_000_000)} mln`);
  if (preferences.tuitionMin !== undefined) constraintsApplied.push(`budget: min ${Math.round(preferences.tuitionMin / 1_000_000)} mln`);
  if (preferences.directionCategory) constraintsApplied.push(`yo'nalish: ${preferences.directionCategory}`);
  if (preferences.preferredCities?.length) constraintsApplied.push(`shahar: ${preferences.preferredCities.join(", ")}`);
  else if (preferences.region) constraintsApplied.push(`hudud: ${preferences.region}`);
  const explicitCats = preferences.institutionCategories?.length
    ? preferences.institutionCategories
    : preferences.institutionCategory
      ? [preferences.institutionCategory]
      : [];
  if (explicitCats.length > 0) constraintsApplied.push(`kategoriya: ${explicitCats.join(",")}`);
  if (preferences.admissionFailed && explicitCats.length === 0) constraintsApplied.push("admissionFailed: xususiy/xalqaro ustuvor");

  const seenNames = new Set<string>();

  for (const cand of candidates) {
    const name = (cand.name || "").trim();
    const reasons: string[] = [];

    // 1) Nomi yo'q → REJECT (invalid)
    if (!name) {
      rejected.push({ name: "(nomsiz)", verdict: "reject", reasons: ["Universitet nomi aniqlanmagan"] });
      continue;
    }

    // 2) Takroriy nom → REJECT (duplicate)
    if (seenNames.has(name.toLowerCase())) {
      rejected.push({ name, verdict: "reject", reasons: ["Takroriy universitеt — bittasi qoldiriladi"] });
      continue;
    }
    seenNames.add(name.toLowerCase());

    // 3) Budget qat'iy buzilishi → REJECT
    const minFee = cand.minimalTuitionFee;
    const maxFee = cand.maximalTuitionFee;
    let budgetViolation = false;
    if (preferences.tuitionMax !== undefined) {
      if (minFee !== undefined && minFee !== null && minFee > preferences.tuitionMax) budgetViolation = true;
      else if ((minFee === undefined || minFee === null) && maxFee !== undefined && maxFee !== null && maxFee > preferences.tuitionMax) budgetViolation = true;
    }
    if (preferences.tuitionMin !== undefined && maxFee !== undefined && maxFee !== null && maxFee < preferences.tuitionMin) budgetViolation = true;
    if (budgetViolation) {
      const mid = minFee && maxFee ? (minFee + maxFee) / 2 : (minFee || maxFee);
      rejected.push({
        name,
        verdict: "reject",
        reasons: [`Byudjetdan oshadi (${mid ? `${Math.round(mid / 1_000_000)} mln` : "narx ma'lum emas"})`],
      });
      continue;
    }

    // 4) Taqiqlangan kategoriya (explicit) → REJECT
    if (explicitCats.length > 0) {
      const rank = categoryRank(cand);
      const rankToCat: Record<string, string> = { private: "4", international: "5", state: "3" };
      const candCat = rankToCat[rank];
      const matches = candCat ? explicitCats.includes(candCat) : false;
      if (!matches) {
        rejected.push({
          name,
          verdict: "reject",
          reasons: [`Kategoriya mos emas (so'ralgan: ${explicitCats.join(",")})`],
        });
        continue;
      }
    }

    // 5) Yumshoq hukmlar (DOWNRANK)
    const rank = categoryRank(cand);
    let down = false;
    if (preferences.admissionFailed && explicitCats.length === 0 && rank === "state") {
      reasons.push("Davlat universiteti — imtihon talab qilishi mumkin (yiqilgan user uchun pastroqda)");
      down = true;
    }
    if (preferences.directionCategory && (!cand.matchedDirections || cand.matchedDirections.length === 0)) {
      reasons.push(`Yo'nalish mosligi topilmadi (${preferences.directionCategory})`);
      down = true;
    }
    const cityMatch = preferences.preferredCities?.length
      ? preferences.preferredCities.some((c) => (cand.location || "").toLowerCase().includes(c.toLowerCase()))
      : undefined;
    if (cityMatch === false) {
      reasons.push("Tanlangan shaharda joylashmagan");
      down = true;
    }

    if (down) {
      downranked.push({ name, verdict: "downrank", reasons });
    } else {
      accepted.push({ name, verdict: "accept", reasons: reasons.length ? reasons : ["Barcha qat'iy qoidalarga mos"] });
    }
  }

  return { accepted, rejected, downranked, constraintsApplied };
}
