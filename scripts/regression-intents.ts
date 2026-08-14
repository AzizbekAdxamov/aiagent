/**
 * MENTALABA AI — INTENT REGRESSION TESTI (Stage 15b)
 *
 * Foydalanuvchi xabarlari uchun yakuniy intent'ni tekshiradi. Har code
 * o'zgarishida ishga tushiriladi:
 *
 *   cd backend
 *   npm run test:regression        (yoki: npx tsx scripts/regression-intents.ts)
 *
 * Nima tekshiriladi:
 *   1. Bir gap — maslahat so'rovi (recommendation) vs fakt/katalog (search)
 *   2. Multi-turn zanjirlar — profil yig'ish, university follow-up, repair,
 *      tavsiyalar navigatsiyasi (augmentFollowUp simulyatsiyasi bilan)
 *   3. Typo tolerance — xato yozilgan so'zlar intent'ni buzmasligi
 *
 * Chiqish kodi: 0 = hammasi o'tdi, 1 = kamida bittasi muvaffaqiyatsiz
 * (CI/pre-commit'da ishlatish uchun).
 */
import { intentClassifier } from "../src/ai-agent/intent-classifier";
import {
  augmentFollowUp,
  isSituationalRecommendation,
  updateRecommendationProfile,
} from "../src/ai-agent/follow-up-context";
import { normalizeUserText } from "../src/ai-agent/text-normalizer";
import { ToolRouter, universityCategoryRank, applyHardBudgetFilter } from "../src/ai-agent/tool-router";
import { computeUniversityQuality } from "../src/ai-agent/university-quality";
import { extractBudget } from "../src/ai-agent/entity-extractor";
import { computeRecommendationDecision, deriveDecisionFacts } from "../src/ai-agent/decision-engine";
import { validateRecommendationResults } from "../src/ai-agent/result-validator";
import type { ChatMessage, IntentResult, SessionContext } from "../src/types";

// ============================================================
// 1. BIR GAP — asosiy ajralishlar
// ============================================================

interface RegressionCase {
  message: string;
  /** Foydalanuvchi nimani istayapti (insonga tushuntirish) */
  want: string;
  /** Kutilayotgan YAKUNIY intent (isSituationalRecommendation override'dan keyin) */
  expected: string;
  /** Session profil — conversation context testlari uchun (ixtiyoriy) */
  profile?: SessionContext["recommendationProfile"];
}

const CASES: RegressionCase[] = [
  {
    message: "men bu yil imtihondan o'tdim lekin qaysi universitetga kirishni bilmay qoldim.",
    want: "Imtihondan o'tgan, qaysi universitetni tanlashni bilmayapti → maslahat so'rayapti",
    expected: "recommendation",
  },
  {
    message: "men bu yil imtihondan yiqildim, lekin ITda o'qishni xohlayman.",
    want: "Imtihondan yiqilgan, ITda o'qimoqchi → xususiy-first tavsiya",
    expected: "recommendation",
  },
  {
    message: "Toshkentda yashayman va tibbiyotga qiziqaman, qaysi universitetni tanlashim kerak?",
    want: "Toshkent + tibbiyot, qaysi universitet kerak → tavsiya",
    expected: "recommendation",
  },
  {
    message: "davlat imtihonlaridan o'tdim, endi qaysi yo'nalishni tanlashni bilmayman.",
    want: "Imtihondan o'tgan, yo'nalish tanlashga yordam → maslahat",
    expected: "recommendation",
  },
  {
    message: "TATUda kontrakti qancha?",
    want: "TATU narxini so'rayapti → fakt so'rovi, katalogga aylanmasligi kerak",
    expected: "tuition_search",
  },
  {
    message: "Toshkentda tibbiyot yo'nalishi bormi?",
    want: "Fakt so'rovi — tibbiyot Toshkentda bormi → katalog qidiruv",
    expected: "direction_search",
  },
  {
    message: "grantga ballim yetmadi, nima qilishim mumkin?",
    want: "Grantga kira olmagan, maslahat kutyapti → alternativa tavsiya",
    expected: "recommendation",
  },
  {
    message: "men doktor bo'lishni orzu qilaman, Toshkentda qaysi universitet yaxshi?",
    want: "Doktor bo'lmoqchi, Toshkentda tavsiya",
    expected: "recommendation",
  },
  {
    message: "bankda ishlashni xohlayman, budjetim 25 million so'm.",
    want: "Bank sohasida ishlamoqchi, 25 mln budget → shaxsiy tavsiya",
    expected: "recommendation",
  },
  {
    message: "salom",
    want: "Oddiy salomlashish → greeting, tool ishlamasligi kerak",
    expected: "greeting",
  },
];

// ============================================================
// 2. MULTI-TURN ZANJIRLAR
// ============================================================

/**
 * Provider-manager oqimini simulyatsiya qiladi: classify → augmentFollowUp →
 * profil yangilash → situational recommendation. Har turndan keyin
 * lastUniversity saqlanadi (tool-router rememberUniversity o'rniga).
 */
function simulateTurns(turns: string[]): Array<{
  msg: string;
  effectiveMessage: string;
  intent: string;
  entities: IntentResult["entities"];
}> {
  const session: SessionContext = {
    language: "uz",
    recommendationProfile: {},
  } as SessionContext;
  const history: ChatMessage[] = [];
  const results: Array<{ msg: string; effectiveMessage: string; intent: string; entities: IntentResult["entities"] }> = [];

  for (const msg of turns) {
    let intent = intentClassifier.classify(msg);
    let effectiveMessage = msg;

    const followUp = augmentFollowUp(msg, session, history, "uz");
    if (followUp.augmented) {
      effectiveMessage = followUp.effectiveMessage;
      intent = followUp.intent;
    }

    if (session.recommendationProfile) {
      session.recommendationProfile = updateRecommendationProfile(
        session.recommendationProfile,
        msg,
        intent.entities
      );
    }

    const overridden = isSituationalRecommendation(effectiveMessage, intent, session);
    const finalIntent = overridden ? "recommendation" : intent.intent;

    results.push({ msg, effectiveMessage, intent: finalIntent, entities: intent.entities });

    history.push({ id: `u${history.length}`, role: "user", content: msg, timestamp: new Date() });
    history.push({ id: `a${history.length}`, role: "assistant", content: "test javob", intent: finalIntent, timestamp: new Date() });

    // tool-router rememberUniversity simulyatsiyasi
    if (intent.entities?.university) {
      session.lastUniversity = { id: 0, name: intent.entities.university, slug: undefined };
    }
  }
  return results;
}

interface MultiTurnCase {
  turns: string[];
  /** Kutilayotgan intent'lar (har turn uchun) */
  expectedIntents: string[];
  want: string;
}

const MULTI_TURN_CASES: MultiTurnCase[] = [
  {
    want: "Profil yig'ish zanjiri — yiqildim (general_chat + admissionFailed=true saqlanadi) → IT → Toshkent → tavsiya so'rovi recommendation bo'ladi",
    turns: [
      "men bu yil imtihondan yiqildim",
      "ITga qiziqaman",
      "Toshkentda yashayman",
      "qaysi universitetni tavsiya qilasan?",
    ],
    // turn1: faqat vaziyat aytilgan, tavsiya so'ralmagan → general_chat (empatiya),
    // lekin admissionFailed=true profilga saqlanadi → turn2-4 recommendation.
    expectedIntents: ["general_chat", "recommendation", "recommendation", "recommendation"],
  },
  {
    want: "University detail zanjiri — TATU haqida → kontrakti qancha? TATUga bog'lanishi kerak",
    turns: ["TATU haqida ma'lumot ber", "Kontrakti qancha?"],
    expectedIntents: ["university_search", "tuition_search"],
  },
  {
    want: "Repair zanjiri — TATU → 'Yo'q, EMUni aytgandim' (university_detail, lastUniversity=EMU) → kontrakti? EMUga bog'lanadi",
    turns: ["TATU haqida ma'lumot ber", "Yo'q, EMUni aytgandim", "Kontrakti qancha?"],
    // turn2: repair bloki "EMU haqida batafsil ma'lumot ber" qiladi → university_detail
    expectedIntents: ["university_search", "university_detail", "tuition_search"],
  },
  {
    want: "Repair zanjiri — TATU → 'Yo'q, boshqa universitet' → aniq nom so'ralishi kerak (clarify)",
    turns: ["TATU haqida ma'lumot ber", "Yo'q, boshqa universitet"],
    expectedIntents: ["university_search", "unknown"],
  },
];

// ============================================================
// 3. TYPO TOLERANCE
// ============================================================

interface TypoCase {
  message: string;
  want: string;
  /** normalizeUserText'dan keyingi kutilgan so'z (mavjud bo'lsa) */
  normalized?: string;
  /** Kutilgan intent (normalizatsiyadan keyin) */
  expectedIntent: string;
  /** Kutilgan entity (mavjud bo'lsa) */
  expectedEntities?: Record<string, string>;
}

const TYPO_CASES: TypoCase[] = [
  {
    message: "hususiy",
    want: "'hususiy' typo → 'xususiy' (x→h) → kategoriya=4",
    normalized: "xususiy",
    expectedIntent: "university_search",
    expectedEntities: { institutionCategory: "4" },
  },
  {
    message: "xusisiy",
    want: "'xusisiy' typo → 'xususiy' (u→i) → kategoriya=4",
    normalized: "xususiy",
    expectedIntent: "university_search",
    expectedEntities: { institutionCategory: "4" },
  },
  {
    message: "davliniki",
    want: "'davliniki' typo → 'davlatniki' → davlat kategoriyasi=3",
    normalized: "davlatniki",
    expectedIntent: "university_search",
    expectedEntities: { institutionCategory: "3" },
  },
  {
    message: "yotoqhonasi bormi",
    want: "'yotoqhonasi' typo → 'yotoqxonasi' → attribute saqlanadi",
    normalized: "yotoqxonasi bormi",
    expectedIntent: "faq",
    expectedEntities: { accommodation: "true" },
  },
  {
    message: "kantrakt narxi",
    want: "'kantrakt' typo → 'kontrakt' → tuition_search",
    normalized: "kontrakt narxi",
    expectedIntent: "tuition_search",
  },
  {
    message: "doktir bolmoqchiman",
    want: "'doktir' → 'doktor' → tibbiyot aniqlanadi (classifier darajasi direction_search; real pipeline'da kasbiy maqsad → recommendation)",
    normalized: "doktor bo'lmoqchiman",
    expectedIntent: "direction_search",
    expectedEntities: { direction: "tibbiyot", careerGoal: "medicine" },
  },
  {
    message: "tibiyotga qiziqaman",
    want: "'tibiyot' typo → 'tibbiyot' → direction=tibbiyot",
    normalized: "tibbiyotga qiziqaman",
    expectedIntent: "direction_search",
    expectedEntities: { direction: "tibbiyot" },
  },
  {
    message: "unversitetga kirmoqchiman",
    want: "'unversitet' typo → 'universitet' → o'qish istagi → recommendation",
    normalized: "universitetga kirmoqchiman",
    expectedIntent: "recommendation",
  },
];

// ============================================================
// 3. RECOMMENDATION POLICY — scoring (API'siz unit test)
// ============================================================

interface PolicyCase {
  name: string;
  want: string;
  uni: Record<string, unknown>;
  preferences: Record<string, unknown>;
  matchedDirs: string[];
  /** Bonus qiymati (admissionFailed bo'limi) */
  expectBonus: number;
  /** Budget balli */
  expectBudget: number;
}

const POLICY_CASES: PolicyCase[] = [
  {
    name: "admissionFailed + xususiy → bonus +20",
    want: "Imtihondan yiqilgan user uchun xususiy univ yuqori ball olishi kerak (+20)",
    uni: { institutionCategoryId: 4, minimalTuitionFee: 15000000, maximalTuitionFee: 19000000, location_uz: "Toshkent" },
    preferences: { admissionFailed: true, directionCategory: "it", tuitionMax: 20000000, region: "14" },
    matchedDirs: ["Data Science"],
    expectBonus: 20,
    expectBudget: 20,
  },
  {
    name: "admissionFailed + xalqaro → bonus +16",
    want: "Xalqaro univ ham bonus oladi, lekin xususiydan kamroq (+16)",
    uni: { institutionCategoryId: 5, minimalTuitionFee: 15000000, maximalTuitionFee: 19000000, location_uz: "Toshkent" },
    preferences: { admissionFailed: true, directionCategory: "it", tuitionMax: 20000000, region: "14" },
    matchedDirs: ["Data Science"],
    expectBonus: 16,
    expectBudget: 20,
  },
  {
    name: "admissionFailed + davlat → penalty -12",
    want: "Davlat univ imtihondan yiqilgan user uchun PENALTY olishi kerak (-12) — lekin butunlay chiqib ketmaydi",
    uni: { institutionCategoryId: 3, minimalTuitionFee: 15000000, maximalTuitionFee: 19000000, location_uz: "Toshkent" },
    preferences: { admissionFailed: true, directionCategory: "it", tuitionMax: 20000000, region: "14" },
    matchedDirs: ["Data Science"],
    expectBonus: -12,
    expectBudget: 20,
  },
  {
    name: "admissionFailed + explicit davlat → bonus 0",
    want: "User 'davlat universiteti' desa (explicit) — admissionFailed bonus qo'llanilmaydi (explicit > inference)",
    uni: { institutionCategoryId: 3, minimalTuitionFee: 15000000, maximalTuitionFee: 19000000, location_uz: "Toshkent" },
    preferences: { admissionFailed: true, institutionCategory: "3", directionCategory: "it", tuitionMax: 20000000, region: "14" },
    matchedDirs: ["Data Science"],
    expectBonus: 0,
    expectBudget: 20,
  },
  {
    name: "budgetdan yuqori → budget 5",
    want: "25-36 mln univ 20 mln budgetda past budget ball olishi kerak (5), HARD filter'dan o'tmaydi",
    uni: { institutionCategoryId: 4, minimalTuitionFee: 25000000, maximalTuitionFee: 36000000, location_uz: "Toshkent" },
    preferences: { admissionFailed: true, directionCategory: "it", tuitionMax: 20000000, region: "14" },
    matchedDirs: ["Data Science"],
    expectBonus: 20,
    expectBudget: 5,
  },
];

// ============================================================
// 4. PROFILE MEMORY — conversation davomida saqlanishi
// ============================================================

const PROFILE_MEMORY_TURNS = [
  "men bu yil imtihondan yiqildim",
  "ITga qiziqaman",
  "Toshkentda yashayman",
  "20 million budjetim bor",
  "grant bo'lsa yaxshi",
];

// ============================================================
// 6. ENTITY EXTRACTION — budget formatlari
// ============================================================

interface BudgetCase {
  message: string;
  want: string;
  expectTuitionMax?: number;
  expectTuitionMin?: number;
  /** Bo'sh bo'lishi kerak (pul muhim emas, arzonroq...) */
  expectEmpty?: boolean;
}

const BUDGET_CASES: BudgetCase[] = [
  { message: "Budjetim 20 mln", want: "Sof '20 mln' → tuitionMax=20m", expectTuitionMax: 20000000 },
  { message: "15 milliondan oshmasin", want: "'milliondan oshmasin' → tuitionMax=15m", expectTuitionMax: 15000000 },
  { message: "20 mln atrofida", want: "'atrofida' → tuitionMax=20m", expectTuitionMax: 20000000 },
  { message: "Eng ko'pi 25 mln", want: "'Eng ko'pi' → tuitionMax=25m", expectTuitionMax: 25000000 },
  { message: "30 milliongacha bera olaman", want: "'milliongacha' → tuitionMax=30m", expectTuitionMax: 30000000 },
  { message: "Kontrakti 20 mln ichida bo'lsin", want: "'ichida bo'lsin' → tuitionMax=20m", expectTuitionMax: 20000000 },
  { message: "10-15 mln oralig'ida", want: "'oralig'ida' → min=10m, max=15m", expectTuitionMin: 10000000, expectTuitionMax: 15000000 },
  { message: "15 dan 30 mln gacha", want: "'dan...gacha' → min=15m, max=30m", expectTuitionMin: 15000000, expectTuitionMax: 30000000 },
  { message: "20 million", want: "'20 million' so'z bilan → tuitionMax=20m", expectTuitionMax: 20000000 },
  { message: "20 000 000", want: "Sof raqam (probel bilan) → tuitionMax=20m", expectTuitionMax: 20000000 },
  { message: "20m", want: "'20m' qisqartma → tuitionMax=20m", expectTuitionMax: 20000000 },
  { message: "20 gacha", want: "Birliksiz '20 gacha' → tuitionMax=20m", expectTuitionMax: 20000000 },
  { message: "20-25 mln", want: "'20-25 mln' oraliq → min=20m, max=25m (faqat max emas!)", expectTuitionMin: 20000000, expectTuitionMax: 25000000 },
  { message: "15 dan 20 gacha", want: "Birliksiz 'dan...gacha' → min=15m, max=20m", expectTuitionMin: 15000000, expectTuitionMax: 20000000 },
  { message: "oyiga 20 mln topaman", want: "Oylik daromad — budget EMAS (false positive guard)", expectEmpty: true },
  { message: "20 mln oyiga topaman, universitetga 20 mln ajrataman", want: "Oylik daromad bo'lagi tashlanadi, LEKIN universitетga ajratilgan 20 mln saqlanadi", expectTuitionMax: 20000000 },
  { message: "20 mln budjetim bor, lekin kerak bo'lsa 25 mln ham beraman", want: "'lekin...ham beraman' → ENGA YUQORI miqdor (25 mln) tuitionMax bo'ladi", expectTuitionMax: 25000000 },
  { message: "Pul muhim emas", want: "Budget cheklovi yo'q → bo'sh", expectEmpty: true },
  { message: "Arzonroq variant kerak", want: "Aniq miqdor yo'q → bo'sh (budgetLevel boshqa joyda)", expectEmpty: true },
];

// ============================================================
// 7. SEMANTIC TRAP / CONTRADICTION
// ============================================================

interface TrapCase {
  message: string;
  want: string;
  /** institutionCategory BO'LIShI KERAK bo'lgan qiymat (masalan "3") yoki undefined */
  expectCategory?: string;
  /** institutionCategory BO'LMA SLIGI KERAK */
  expectNoCategory?: boolean;
  /** admissionFailed=true bo'lishi kerak */
  expectAdmissionFailed?: boolean;
}

const TRAP_CASES: TrapCase[] = [
  {
    message: "Men davlat universitetiga kirishni juda xohlardim, lekin bu yil ballim yetmadi. Endi o'qishni kechiktirmoqchi emasman.",
    want: "Semantic trap: davlatga kirishni XOHLAGAN, lekin balli yetmagan → institutionCategory EMAS, private-first kerak",
    expectNoCategory: true,
    expectAdmissionFailed: true,
  },
  {
    message: "Men davlat imtihonidan o'tdim, davlat universitetini tanlamoqchiman.",
    want: "Amaliy davlat istagi → institutionCategory=3 (davlat imtihoni o'tish → davlat emas, lekin tanlamoqchiman → davlat)",
    expectCategory: "3",
  },
  {
    message: "Davlat universitetiga kira olmadim, menga davlat universiteti tavsiya qil.",
    want: "Contradiction: kira olmagan LEKIN explicit davlat so'rayapti → explicit ustun (3) + admissionFailed=true",
    expectCategory: "3",
    expectAdmissionFailed: true,
  },
  {
    message: "Imtihondan yiqildim, faqat grantli universitet kerak.",
    want: "Yiqilgan + grant istagi → admissionFailed=true, kategoriya yo'q (private-first ishlaydi)",
    expectNoCategory: true,
    expectAdmissionFailed: true,
  },
  {
    message: "Xususiy universitet istamayman, lekin shu yil o'qishga kirishim kerak.",
    want: "Negativ istak: xususiy ISTAMAYMAN → kategoriya EMAS, wantsToStudy=true",
    expectNoCategory: true,
  },
  {
    message: "Toshkentda yashayman, Samarqandda o'qimoqchiman.",
    want: "Yashash joyi vs o'qish joyi: preferredCities=[toshkent, samarqand], o'qish joyi ustun",
    expectNoCategory: true,
  },
];

// ============================================================
// 9. NEGATIVE INTENT / SEMANTIC BOUNDARY
// ============================================================

interface NegativeCase {
  message: string;
  want: string;
  /** Kategoriya bo'lmasligi kerak (negativ istak) */
  expectNoCategory?: boolean;
  /** Kutilgan kategoriya (bo'lsa) */
  expectCategory?: string;
  /** Kutilgan intent */
  expectedIntent?: string;
}

const NEGATIVE_CASES: NegativeCase[] = [
  {
    message: "Tibbiyotga qiziqaman, lekin xususiy bo'lmasin",
    want: "Negativ: 'xususiy bo'lmasin' → kategoriya=4 EMAS (xususiy istamayapti)",
    expectNoCategory: true,
  },
  {
    message: "IT kerak, faqat davlat universiteti",
    want: "'faqat davlat' → kategoriya=3 (explicit)",
    expectCategory: "3",
  },
  {
    message: "Xususiy ham davlat ham farqi yo'q",
    want: "Kategoriyaga befarq (farqi yo'q = qaysi biri bo'lsa ham) → comparison EMAS, recommendation; kategoriya filteri yo'q",
    expectedIntent: "recommendation",
    expectNoCategory: true,
  },
  {
    message: "Davlatni xohlayman, lekin kira olmasam xususiy ham bo'ladi",
    want: "Davlat primary, xususiy fallback → ikkala kategoriya saqlanadi",
    expectedIntent: "recommendation",
  },
  {
    message: "men bankda ishlamoqchiman",
    want: "Kasbiy maqsad → recommendation (direction=iqtisod aniqlanadi)",
    expectedIntent: "recommendation",
  },
  {
    message: "bank ishi kontrakti qancha?",
    want: "Fakt so'rovi → tuition_search (bank → iqtisod yo'nalishi)",
    expectedIntent: "tuition_search",
  },
  {
    message: "TDIUda bank ishi bormi?",
    want: "Universitet-spetsifik → direction_search (university=TDIU)",
    expectedIntent: "direction_search",
  },
];

// ============================================================
// 10. ADVERSARIAL BOUNDARY — "yo'q/lekin/faqat/ham/emas" so'zlari
// ============================================================

interface AdversarialCase {
  message: string;
  want: string;
  /** Kutilgan intent */
  expectedIntent?: string;
  /** Kategoriya BO'LMASLIGI kerak */
  expectNoCategory?: boolean;
  /** Kutilgan kategoriya */
  expectCategory?: string;
  /** University entity BO'LMASLIGI kerak (rad etilgan) */
  expectNoUniversity?: boolean;
  /** Kutilgan tuitionMax */
  expectTuitionMax?: number;
}

const ADVERSARIAL_CASES: AdversarialCase[] = [
  {
    message: "yo'q TATU emas",
    want: "Negativ reference: TATU RAD etilgan → university entity bo'lmasligi kerak",
    expectNoUniversity: true,
  },
  {
    message: "TATU kerak emas",
    want: "'kerak emas' — rad etilgan universitеt → entity yo'q",
    expectNoUniversity: true,
  },
  {
    message: "PDPda xususiy emas, nima deysiz?",
    want: "PDP HAQIDA gap (negativ atribut) — universitеt entity SAQLANADI",
    expectedIntent: "university_search",
  },
  {
    message: "Xususiy bo'lmasin, lekin yaxshi xususiy bo'lsa ko'rishim mumkin",
    want: "Boshdagi 'bo'lmasin' ustun → xususiy kategoriya EMAS (ikkinchi ijobiy mention qolmasligi kerak)",
    expectNoCategory: true,
  },
  {
    message: "davlat bo'lmasin, xususiy kerak",
    want: "'davlat bo'lmasin' → davlat EMAS, xususiy saqlanadi",
    expectCategory: "4",
  },
  {
    message: "grant shart emas",
    want: "Negativ imtiyoz: 'shart emas' → grant_search EMAS (faq/suhbat)",
    expectedIntent: "faq",
  },
  {
    message: "Grant kerak, kontrakt ham bo'lishi mumkin",
    want: "Grant afzalligi + kontrakt imkoniyati — NARX so'rovi emas → recommendation",
    expectedIntent: "recommendation",
  },
  {
    message: "Men TATUni xohlayman, lekin kira olmadim",
    want: "TATU istagi + admissionFailed → recommendation (maslahat)",
    expectedIntent: "recommendation",
  },
];

// ============================================================
// 12. MISSING INFO / CONFIDENCE — clarification qaror qatlami
//     (decision-engine: direct / clarify / conversational)
// ============================================================

interface MissingInfoCase {
  message: string;
  want: string;
  /** Yakuniy intent */
  expectedIntent: string;
  /** Decision mode */
  expectedMode: "direct" | "clarify" | "conversational";
  /** Clarify bo'lsa kutilgan missing'lar (tartibsiz taqqoslanadi) */
  expectedMissing?: string[];
  expectedNeedsTool?: boolean;
}

const MISSING_INFO_CASES: MissingInfoCase[] = [
  {
    message: "Qaysi universitetni tavsiya qilasan?",
    want: "Yo'nalish ham, shahar ham yo'q → toolga 46 ta universitеt yuborilmaydi, avval aniqlashtirish",
    expectedIntent: "recommendation",
    expectedMode: "clarify",
    expectedMissing: ["directionCategory", "region"],
    expectedNeedsTool: true,
  },
  {
    message: "IT uchun universitet kerak",
    want: "Yo'nalish bor, shahar yo'q → shahar so'raladi (region missing)",
    expectedIntent: "direction_search",
    expectedMode: "clarify",
    expectedMissing: ["region"],
  },
  {
    message: "Toshkentda universitet kerak",
    want: "Shahar bor, yo'nalish yo'q → yo'nalish so'raladi; 'toshkentda universitet' bogus entity bo'lmasligi kerak",
    expectedIntent: "university_search",
    expectedMode: "clarify",
    expectedMissing: ["directionCategory"],
  },
  {
    message: "20 mln budjetim bor",
    want: "Faqat byudjet — yo'nalish/shahar yo'q → suhbat rejimi, tool chaqirilmaydi (nima kerakligini so'raydi)",
    expectedIntent: "faq",
    expectedMode: "conversational",
    expectedNeedsTool: false,
  },
  {
    message: "Men bu yil yiqildim, nima qilay?",
    want: "Yiqilgan lekin MASLAHAT so'rayapti → general_chat, recommend tool YO'Q",
    expectedIntent: "general_chat",
    expectedMode: "conversational",
    expectedNeedsTool: false,
  },
  {
    message: "Men bu yil imtihondan yiqildim, ITga qiziqaman, Toshkentda yashayman, 20 mln budjetim bor. Qaysi universitetni tavsiya qilasan?",
    want: "Barcha muhim ma'lumot bor (yo'nalish+shahar+byudjet+vaziyat) → DIRECT, tool ishlaydi",
    expectedIntent: "recommendation",
    expectedMode: "direct",
    expectedMissing: [],
    expectedNeedsTool: true,
  },
];

// ============================================================
// 13. END-TO-END CONVERSATION — 5-10 turnlik suhbatlarda qaror
// ============================================================

interface ConversationTurn {
  message: string;
  /** Shu turn uchun kutilgan qaror (ixtiyoriy — profil yig'ish turnlarida aniqlanmasa ham bo'ladi) */
  expectMode?: "direct" | "clarify" | "conversational";
  /** Shu turn uchun kutilgan intent (final) */
  expectIntent?: string;
  /** Shu turndan keyin profilga yozilishi kerak */
  expectProfile?: { admissionFailed?: boolean; interests?: string[]; city?: string; budget?: number; institutionCategory?: string };
}

interface ConversationCase {
  name: string;
  want: string;
  turns: ConversationTurn[];
}

const CONVERSATION_CASES: ConversationCase[] = [
  {
    name: "yiqildim → IT → Toshkent → 20 mln → tavsiya (profil yig'ilishi)",
    want: "5 turn davomida profil yig'iladi, oxirgi turnda DIRECT bo'ladi (tool ishlaydi)",
    turns: [
      { message: "Men bu yil imtihondan yiqildim", expectMode: "conversational", expectIntent: "general_chat", expectProfile: { admissionFailed: true } },
      { message: "ITga qiziqaman", expectProfile: { admissionFailed: true, interests: ["it"] } },
      { message: "Toshkentda yashayman", expectProfile: { admissionFailed: true, interests: ["it"], city: "toshkent" } },
      { message: "20 mln budjetim bor", expectProfile: { admissionFailed: true, interests: ["it"], city: "toshkent", budget: 20000000 } },
      // ENG MUHIM: profil to'lgach 'tavsiya qil' → DIRECT (tool ishlaydi)
      { message: "Qaysi universitetni tavsiya qilasan?", expectMode: "direct", expectIntent: "recommendation", expectProfile: { admissionFailed: true, interests: ["it"], city: "toshkent", budget: 20000000 } },
    ],
  },
  {
    name: "yiqildim → nima qilay? → hali ham MASLAHAT (tool yo'q)",
    want: "admission-related message har doim recommendation EMAS — 'nima qilay' general_chat bo'lib qoladi",
    turns: [
      { message: "Men bu yil yiqildim", expectMode: "conversational", expectIntent: "general_chat" },
      { message: "Lekin o'qishni juda xohlayman", expectProfile: { admissionFailed: true } },
      // ENG MUHIM: 'nima qilay' — maslahat, recommend tool YO'Q
      { message: "Nima qilishim mumkin?", expectMode: "conversational", expectIntent: "general_chat" },
    ],
  },
  {
    name: "TATU haqida → kontrakti? → universitеtga bog'lanadi",
    want: "University follow-up: oxirgi turn tuition_search, TATU kontekstga bog'lanadi",
    turns: [
      { message: "TATU haqida ma'lumot ber" },
      // ENG MUHIM: follow-up TATU kontekstiga bog'lanadi (tuition_search)
      { message: "Kontrakti qancha?", expectIntent: "tuition_search" },
    ],
  },
];

// ============================================================
// 11. HARD BUDGET FILTER — deterministik unit test (API'siz)
// ============================================================

interface HardBudgetCase {
  name: string;
  want: string;
  unis: Array<{ name: string; min?: number | null; max?: number | null }>;
  tuitionMax?: number;
  tuitionMin?: number;
  /** Qolishi kerak bo'lgan univ nomlari */
  expectKept: string[];
  /** Chiqib ketishi kerak bo'lgan univ nomlari */
  expectRemoved: string[];
}

const HARD_BUDGET_CASES: HardBudgetCase[] = [
  {
    name: "20 mln budget → Amity 25-36 chiqariladi",
    want: "User '20 mln' desa, minimal kontrakti 25 mln bo'lgan univ HARD chiqariladi (LLM 'yaxshi variant' deb yuborolmaydi)",
    unis: [
      { name: "Amity", min: 25000000, max: 36000000 },
      { name: "TAFU", min: 15000000, max: 19000000 },
      { name: "Xalqaro Nordik", min: 12000000, max: 18000000 },
    ],
    tuitionMax: 20000000,
    expectKept: ["TAFU", "Xalqaro Nordik"],
    expectRemoved: ["Amity"],
  },
  {
    name: "20 mln budget → ATU 49-57 chiqariladi",
    want: "Budjetdan ancha yuqori univlar ham chiqariladi (faqat 'yaqin' emas)",
    unis: [
      { name: "ATU", min: 49000000, max: 57000000 },
      { name: "TDTU", min: 18000000, max: 22000000 },
    ],
    tuitionMax: 20000000,
    expectKept: ["TDTU"],
    expectRemoved: ["ATU"],
  },
  {
    name: "tuitionMin → arzonlari chiqariladi",
    want: "'Kamida X' — maksimal narxi past bo'lgan univ chiqariladi",
    unis: [
      { name: "Arzon", min: 5000000, max: 8000000 },
      { name: "O'rta", min: 12000000, max: 18000000 },
    ],
    tuitionMin: 10000000,
    expectKept: ["O'rta"],
    expectRemoved: ["Arzon"],
  },
  {
    name: "budget yo'q → hammasi qoladi",
    want: "Budget cheklovi bo'lmasa hech narsa chiqarilmaydi",
    unis: [
      { name: "Amity", min: 25000000, max: 36000000 },
      { name: "TAFU", min: 15000000, max: 19000000 },
    ],
    expectKept: ["Amity", "TAFU"],
    expectRemoved: [],
  },
  {
    name: "narx ma'lumoti yo'q → qoladi",
    want: "Narxi noma'lum univ chiqarilmaydi (scoring neytral qoladi)",
    unis: [
      { name: "Noma'lum narx", min: null, max: null },
      { name: "Amity", min: 25000000, max: 36000000 },
    ],
    tuitionMax: 20000000,
    expectKept: ["Noma'lum narx"],
    expectRemoved: ["Amity"],
  },
];

// ============================================================
// 10. DECISION REGRESSION — admission + budget + direction policy
//     (scoring natijasida to'g'ri qaror chiqishi)
// ============================================================

interface DecisionCase {
  name: string;
  want: string;
  unis: Array<{
    name: string;
    institutionCategoryId: number;
    min: number;
    max: number;
    location: string;
    dirs: string[];
  }>;
  preferences: Record<string, unknown>;
  /** Eng yuqori ball olgan univ nomi */
  expectBestName: string;
  /** #1 davlat bo'lmasligi kerakmi */
  expectNoStateFirst?: boolean;
}

const DECISION_CASES: DecisionCase[] = [
  {
    name: "yiqildim + IT + Toshkent + 20 mln → xususiy, byudjetga mos birinchi",
    want: "AdmissionFailed: xususiy +20, davlat -12; 20 mln: Amity (25-36) budgetdan oshadi. Eng mos: TAFU (xususiy, 15-19m)",
    unis: [
      { name: "TATU", institutionCategoryId: 3, min: 15000000, max: 57000000, location: "Toshkent", dirs: ["Data Science", "Sun'iy intellekt"] },
      { name: "Amity", institutionCategoryId: 4, min: 25000000, max: 36000000, location: "Toshkent", dirs: ["Data Science"] },
      { name: "TAFU", institutionCategoryId: 4, min: 15000000, max: 19000000, location: "Toshkent", dirs: ["Data Science", "Kompyuter injiniringi"] },
      { name: "Xalqaro Nordik", institutionCategoryId: 5, min: 12000000, max: 18000000, location: "Toshkent", dirs: ["Data Science"] },
    ],
    preferences: { admissionFailed: true, directionCategory: "it", tuitionMax: 20000000, preferredCities: ["toshkent"], region: "14" },
    expectBestName: "TAFU",
    expectNoStateFirst: true,
  },
  {
    name: "normal user (yiqilmagan) + IT + Toshkent → TATU ham birinchi bo'lishi mumkin",
    want: "AdmissionFailed bo'lmasa davlat penalty olmaydi — TATU (davlat, ko'p yo'nalish) yuqori ball olishi mumkin",
    unis: [
      { name: "TATU", institutionCategoryId: 3, min: 15000000, max: 57000000, location: "Toshkent", dirs: ["Data Science", "Sun'iy intellekt", "Kompyuter injiniringi", "Dasturiy injiniring"] },
      { name: "TAFU", institutionCategoryId: 4, min: 15000000, max: 19000000, location: "Toshkent", dirs: ["Data Science"] },
    ],
    preferences: { directionCategory: "it", tuitionMax: 57000000, preferredCities: ["toshkent"], region: "14" },
    expectBestName: "TATU",
    expectNoStateFirst: false,
  },
];

// ============================================================
// 11. RECOMMENDATION QUALITY REGRESSION — to'g'ri universitеt tanlash
//     (intent emas — REAL ranking sifati: hard filter + scoring + top-N)
// ============================================================

interface QualityCase {
  name: string;
  want: string;
  unis: Array<{
    name: string;
    institutionCategoryId: number;
    min: number | null;
    max: number | null;
    location: string;
    dirs: string[];
  }>;
  preferences: Record<string, unknown>;
  /** #1 bo'lishi kerak bo'lgan univ nomi */
  topIs?: string;
  /** Birinchi N ta univ hammasi xususiy/xalqaro bo'lishi kerak */
  topNPrivateOrIntl?: number;
  /** #1 davlat bo'lmasligi kerak (admissionFailed) */
  noStateFirst?: boolean;
  /** Natijada umuman bo'lmasligi kerak bo'lgan nomlar (hard-filter) */
  topExcludes?: string[];
  /** #1 reasons'larida kamida bittasi shu regex'lardan biriga mos bo'lishi */
  reasonsTop?: string[];
}

const QUALITY_CASES: QualityCase[] = [
  {
    name: "yiqildim + IT + Toshkent + 20 mln → TAFU #1, top-3 xususiy/xalqaro",
    want: "Amity (25-36m) va ATU (49-57m) hard-filter'da chiqadi; TAFU (xususiy, 17m, IT) #1; top-3 da davlat yo'q; #1 da sabablar bor",
    unis: [
      { name: "TATU", institutionCategoryId: 3, min: 15000000, max: 57000000, location: "Toshkent", dirs: ["Data Science", "Sun'iy intellekt", "Kompyuter injiniringi", "Dasturiy injiniring"] },
      { name: "Amity", institutionCategoryId: 4, min: 25000000, max: 36000000, location: "Toshkent", dirs: ["Data Science"] },
      { name: "ATU", institutionCategoryId: 3, min: 49000000, max: 57000000, location: "Toshkent", dirs: ["Data Science"] },
      { name: "TAFU", institutionCategoryId: 4, min: 15000000, max: 19000000, location: "Toshkent", dirs: ["Data Science", "Kompyuter injiniringi"] },
      { name: "Xalqaro Nordik", institutionCategoryId: 5, min: 12000000, max: 18000000, location: "Toshkent", dirs: ["Data Science"] },
      { name: "TDIU", institutionCategoryId: 4, min: 12000000, max: 15000000, location: "Toshkent", dirs: ["Iqtisodiyot"] },
    ],
    preferences: { admissionFailed: true, directionCategory: "it", tuitionMax: 20000000, preferredCities: ["toshkent"], region: "14" },
    topIs: "TAFU",
    topNPrivateOrIntl: 3,
    noStateFirst: true,
    topExcludes: ["Amity", "ATU"],
    reasonsTop: ["xususiy", "byudjet|mos", "yo'nalish"],
  },
  {
    name: "normal user (yiqilmagan) + IT + Toshkent → TATU #1 mumkin",
    want: "AdmissionFailed yo'q → davlat penalty olmaydi; kuchli yo'nalish bazasi (4 ta) bilan TATU #1 bo'ladi",
    unis: [
      { name: "TATU", institutionCategoryId: 3, min: 15000000, max: 57000000, location: "Toshkent", dirs: ["Data Science", "Sun'iy intellekt", "Kompyuter injiniringi", "Dasturiy injiniring"] },
      { name: "TAFU", institutionCategoryId: 4, min: 15000000, max: 19000000, location: "Toshkent", dirs: ["Data Science", "Kompyuter injiniringi"] },
      { name: "Xalqaro Nordik", institutionCategoryId: 5, min: 12000000, max: 18000000, location: "Toshkent", dirs: ["Data Science"] },
    ],
    preferences: { directionCategory: "it", preferredCities: ["toshkent"], region: "14" },
    topIs: "TATU",
    noStateFirst: false,
  },
  {
    name: "yiqildim + EXPLICIT davlat → TATU #1 (explicit > inference)",
    want: "'davlatga kira olmadim, menga davlat tavsiya qil' — explicit kategoriya private-first bonusni bekor qiladi",
    unis: [
      { name: "TATU", institutionCategoryId: 3, min: 15000000, max: 57000000, location: "Toshkent", dirs: ["Data Science", "Sun'iy intellekt", "Kompyuter injiniringi", "Dasturiy injiniring"] },
      { name: "TAFU", institutionCategoryId: 4, min: 15000000, max: 19000000, location: "Toshkent", dirs: ["Data Science", "Kompyuter injiniringi"] },
      { name: "Xalqaro Nordik", institutionCategoryId: 5, min: 12000000, max: 18000000, location: "Toshkent", dirs: ["Data Science"] },
    ],
    preferences: { admissionFailed: true, institutionCategory: "3", directionCategory: "it", tuitionMax: 57000000, preferredCities: ["toshkent"], region: "14" },
    topIs: "TATU",
    noStateFirst: false,
  },
  {
    name: "yiqildim + tibbiyot + Toshkent → xususiy tibbiyot #1",
    want: "Tibbiyotda ham private-first: davlat TTA pastda, xususiy tibbiyot univ #1",
    unis: [
      { name: "TTA", institutionCategoryId: 3, min: 20000000, max: 30000000, location: "Toshkent", dirs: ["Davolash ishi", "Pediatriya", "Stomatologiya"] },
      { name: "Toshkent amaliy tibbiyot instituti", institutionCategoryId: 4, min: 15000000, max: 25000000, location: "Toshkent", dirs: ["Davolash ishi", "Stomatologiya"] },
    ],
    preferences: { admissionFailed: true, directionCategory: "tibbiyot", preferredCities: ["toshkent"], region: "14" },
    topIs: "Toshkent amaliy tibbiyot instituti",
    noStateFirst: true,
  },
  {
    name: "budget hard-filter natijada Amity yo'q, reasons #1 da bor",
    want: "25-36m Amity 20m budgetda natijada umuman yo'q; qolganlarning #1 reasons'larida tushuntirish bor",
    unis: [
      { name: "Amity", institutionCategoryId: 4, min: 25000000, max: 36000000, location: "Toshkent", dirs: ["Data Science"] },
      { name: "TAFU", institutionCategoryId: 4, min: 15000000, max: 19000000, location: "Toshkent", dirs: ["Data Science", "Kompyuter injiniringi"] },
    ],
    preferences: { directionCategory: "it", tuitionMax: 20000000, preferredCities: ["toshkent"], region: "14" },
    topIs: "TAFU",
    topExcludes: ["Amity"],
    reasonsTop: ["byudjet|mos", "yo'nalish"],
  },
];

// ============================================================
// 14. TOOL RESULT VALIDATION — tool natijasi policy tekshiruvi (STAGE 16)
// ============================================================

interface ValidationCase {
  name: string;
  want: string;
  unis: Array<{
    name: string;
    institutionCategoryId?: number;
    institutionCategory?: string;
    min?: number | null;
    max?: number | null;
    location?: string;
    matchedDirections?: string[];
  }>;
  preferences: Record<string, unknown>;
  expectRejected: string[];
  expectDownranked: string[];
  expectAccepted: string[];
  expectConstraint?: string;
}

const VALIDATION_CASES: ValidationCase[] = [
  {
    name: "20 mln budget → Amity/ATU REJECT, TATU downrank, TAFU/Nordik accept",
    want: "Yiqilgan user + IT + Toshkent + 20 mln: byudjetdan oshganlar REJECT, davlat DOWNRANK, moslar ACCEPT",
    unis: [
      { name: "TAFU", institutionCategoryId: 4, min: 15000000, max: 19000000, location: "Toshkent", matchedDirections: ["Data Science"] },
      { name: "Xalqaro Nordik", institutionCategoryId: 5, min: 12000000, max: 18000000, location: "Toshkent", matchedDirections: ["Data Science"] },
      { name: "TATU", institutionCategoryId: 3, min: 15000000, max: 57000000, location: "Toshkent", matchedDirections: ["Data Science"] },
      { name: "Amity", institutionCategoryId: 4, min: 25000000, max: 36000000, location: "Toshkent", matchedDirections: ["Data Science"] },
      { name: "ATU", institutionCategoryId: 3, min: 49000000, max: 57000000, location: "Toshkent", matchedDirections: ["Data Science"] },
    ],
    preferences: { admissionFailed: true, directionCategory: "it", tuitionMax: 20000000, preferredCities: ["toshkent"] },
    expectRejected: ["Amity", "ATU"],
    expectDownranked: ["TATU"],
    expectAccepted: ["TAFU", "Xalqaro Nordik"],
    expectConstraint: "admissionFailed",
  },
  {
    name: "explicit davlat (3) → xususiy REJECT",
    want: "'faqat davlat' desa xususiy universitеt REJECT qilinadi (forbidden category)",
    unis: [
      { name: "TATU", institutionCategoryId: 3, min: 15000000, max: 57000000, location: "Toshkent", matchedDirections: ["Data Science"] },
      { name: "TAFU", institutionCategoryId: 4, min: 15000000, max: 19000000, location: "Toshkent", matchedDirections: ["Data Science"] },
    ],
    preferences: { institutionCategory: "3", directionCategory: "it", tuitionMax: 60000000 },
    expectRejected: ["TAFU"],
    expectDownranked: [],
    expectAccepted: ["TATU"],
    expectConstraint: "kategoriya",
  },
  {
    name: "duplicate + nom yo'q → REJECT",
    want: "Takroriy universitеt va nomsiz kandidat natijadan chiqariladi",
    unis: [
      { name: "TAFU", institutionCategoryId: 4, min: 15000000, max: 19000000, location: "Toshkent", matchedDirections: ["Data Science"] },
      { name: "TAFU", institutionCategoryId: 4, min: 15000000, max: 19000000, location: "Toshkent", matchedDirections: ["Data Science"] },
      { name: "", institutionCategoryId: 4, min: 15000000, max: 19000000, location: "Toshkent" },
    ],
    preferences: { directionCategory: "it", tuitionMax: 30000000 },
    expectRejected: ["TAFU", "(nomsiz)"],
    expectDownranked: [],
    expectAccepted: ["TAFU"],
  },
  {
    name: "shahar mos emas → DOWNRANK",
    want: "'Toshkentda' desa Samarqanddagi universitеt pastroqda turadi",
    unis: [
      { name: "SamDU", institutionCategoryId: 3, min: 12000000, max: 18000000, location: "Samarqand", matchedDirections: ["Data Science"] },
      { name: "TATU", institutionCategoryId: 3, min: 15000000, max: 57000000, location: "Toshkent", matchedDirections: ["Data Science"] },
    ],
    preferences: { directionCategory: "it", preferredCities: ["toshkent"] },
    expectRejected: [],
    expectDownranked: ["SamDU"],
    expectAccepted: ["TATU"],
  },
];

// ============================================================
// 8. FOLLOW-UP BINDING — tavsiyadan keyin oldingi univga bog'lanish
// ============================================================

const FOLLOW_UP_TURNS = [
  "Toshkent Amaliy Fanlar Universiteti",
  "Kontrakti qancha?",
  "Grant bormi?",
  "Yotoqxonasi bormi?",
  "Qaysi yo'nalishlari bor?",
];

// ============================================================
// 5. LIVE E2E — to'liq recommend() natijasi (API bilan)
//    Ishlatish: npx tsx scripts/regression-intents.ts --live
// ============================================================

async function runLiveRecommendationTest(): Promise<void> {
  console.log("");
  console.log("=".repeat(60));
  console.log("5️⃣ LIVE RECOMMENDATION POLICY (real API)");
  console.log("=".repeat(60));

  const router: any = new ToolRouter();
  const sessionContext: any = {
    language: "uz",
    isGuest: false,
    recommendationProfile: {
      admissionFailed: true,
      interests: ["it"],
      city: "toshkent",
      preferredCities: ["toshkent"],
      budget: 20000000,
    },
  };
  const intent: any = {
    intent: "recommendation",
    entities: { queryType: "recommendation" },
  };

  try {
    const result = await Promise.race([
      router.recommend(intent, sessionContext, "imtihondan yiqildim, ITga qiziqaman, Toshkentda yashayman, budjetim 20 mln"),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout 60s")), 60000)),
    ]);
    const recs: any[] = result?.data?.recommendations || [];
    if (recs.length === 0) {
      console.log(`❌ LIVE: 0 ta tavsiya qaytdi (data: ${JSON.stringify(result?.data || {}).slice(0, 200)})`);
      fail++;
      return;
    }

    const names = recs.map((r: any) => r.fullNameUz || r.name || "?");
    const cats = recs.map((r: any) => universityCategoryRank(r));
    console.log(`   Tavsiyalar (${recs.length}):`);
    recs.forEach((r: any, i: number) => {
      const minFee = r.minimalTuitionFee ?? r.minimal_tuition_fee;
      console.log(`   ${i + 1}. ${r.fullNameUz || r.name} [${universityCategoryRank(r)}] ${minFee ? Math.round(minFee / 1_000_000) + " mln" : "narx yo'q"}`);
    });

    // 1) private-first: birinchi tavsiya davlat bo'lmasligi kerak
    const firstIsState = cats[0] === "state";
    const stateCount = cats.filter((c: string) => c === "state").length;
    const okPrivateFirst = !firstIsState;
    const okStateNotFirst = stateCount < recs.length; // hammasi davlat bo'lmasligi

    // 2) budget: 25 mln+ univlar chiqib ketishi kerak (20 mln budget)
    const overBudget = recs.filter((r: any) => {
      const minFee = r.minimalTuitionFee ?? r.minimal_tuition_fee;
      return typeof minFee === "number" && minFee > 20000000;
    });
    const okBudget = overBudget.length === 0;

    const allOk = okPrivateFirst && okBudget && !firstIsState;
    const mark = allOk ? "✅" : "❌";
    console.log(`${mark} private-first (birinchi davlat EMAS): ${!firstIsState ? "ha" : "YO'Q — birinchi: " + names[0]}`);
    console.log(`${mark} budget 20 mln (25 mln+ chiqarilgan): ${okBudget ? "ha — barchasi mos" : "YO'Q: " + overBudget.map((r: any) => r.fullNameUz || r.name).join(", ")}`);
    if (allOk) pass++;
    else fail++;
  } catch (e: any) {
    console.log(`❌ LIVE: xato — ${e.message}`);
    fail++;
  }
}

// ============================================================
// RUNNER
// ============================================================

let pass = 0;
let fail = 0;
const LIVE_MODE = process.argv.includes("--live");

function check(
  name: string,
  want: string,
  actual: string,
  expected: string,
  extra?: string
): void {
  const ok = actual === expected;
  const mark = ok ? "✅" : "❌";
  console.log(`${mark} ${name}`);
  console.log(`   istagi: ${want}`);
  console.log(`   kutilgan: ${expected} | haqiqiy: ${actual}${extra ? ` | ${extra}` : ""}`);
  if (ok) pass++;
  else fail++;
}

console.log("=".repeat(60));
console.log("1️⃣ BIR GAP — MASLAHAT vs FAKT/KATALOG");
console.log("=".repeat(60));

for (const c of CASES) {
  const intent: IntentResult = intentClassifier.classify(c.message);
  const sessionCtx = c.profile
    ? ({ recommendationProfile: c.profile } as SessionContext)
    : undefined;
  const overridden = isSituationalRecommendation(c.message, intent, sessionCtx);
  const finalIntent = overridden ? "recommendation" : intent.intent;
  check(`"${c.message}"`, c.want, finalIntent, c.expected);
}

console.log("");
console.log("=".repeat(60));
console.log("2️⃣ MULTI-TURN ZANJIRLAR");
console.log("=".repeat(60));

for (const mt of MULTI_TURN_CASES) {
  const results = simulateTurns(mt.turns);
  let allOk = true;
  results.forEach((r, i) => {
    const expected = mt.expectedIntents[i];
    const ok = r.intent === expected;
    if (!ok) allOk = false;
    console.log(`${ok ? "✅" : "❌"}  turn${i + 1}: "${r.msg}" → ${r.intent} (kutilgan: ${expected})${r.effectiveMessage !== r.msg ? ` | effective: ${r.effectiveMessage}` : ""}`);
  });
  console.log(`   istagi: ${mt.want}`);
  if (allOk) pass++;
  else fail++;
}

console.log("");
console.log("=".repeat(60));
console.log("3️⃣ TYPO TOLERANCE");
console.log("=".repeat(60));

for (const c of TYPO_CASES) {
  const normalized = normalizeUserText(c.message);
  const intent: IntentResult = intentClassifier.classify(normalized);
  const normOk = c.normalized ? normalized === c.normalized : true;
  const intentOk = intent.intent === c.expectedIntent;
  const entitiesOk = c.expectedEntities
    ? Object.entries(c.expectedEntities).every(
        ([k, v]) => String((intent.entities as Record<string, unknown>)?.[k]) === v
      )
    : true;
  const ok = normOk && intentOk && entitiesOk;
  const mark = ok ? "✅" : "❌";
  console.log(`${mark} "${c.message}" → norm="${normalized}" → intent=${intent.intent} entities=${JSON.stringify(intent.entities)}`);
  console.log(`   istagi: ${c.want}`);
  if (!normOk) {
    console.log(`   ❌ normalizatsiya: kutilgan "${c.normalized}"`);
    fail++;
  } else if (ok) {
    pass++;
  } else {
    console.log(`   ❌ kutilgan intent: ${c.expectedIntent}, entities: ${JSON.stringify(c.expectedEntities)}`);
    fail++;
  }
}

console.log("");
console.log("=".repeat(60));
console.log("4️⃣ RECOMMENDATION POLICY (scoring unit test)");
console.log("=".repeat(60));

const router: any = new ToolRouter();
for (const c of POLICY_CASES) {
  const score = router.computeRecommendationScore(c.uni, c.preferences, c.matchedDirs);
  const bonusOk = score.breakdown.bonus === c.expectBonus;
  const budgetOk = score.breakdown.budget === c.expectBudget;
  const ok = bonusOk && budgetOk;
  const mark = ok ? "✅" : "❌";
  console.log(`${mark} ${c.name}`);
  console.log(`   istagi: ${c.want}`);
  console.log(`   bonus=${score.breakdown.bonus} (kutilgan: ${c.expectBonus}) | budget=${score.breakdown.budget} (kutilgan: ${c.expectBudget}) | total=${score.total}`);
  if (ok) pass++;
  else fail++;
}

console.log("");
console.log("=".repeat(60));
console.log("6️⃣ ENTITY EXTRACTION — BUDGET FORMATLARI");
console.log("=".repeat(60));

for (const c of BUDGET_CASES) {
  const b = extractBudget(c.message);
  const ok = c.expectEmpty
    ? b.tuitionMax === undefined && b.tuitionMin === undefined
    : b.tuitionMax === c.expectTuitionMax && b.tuitionMin === c.expectTuitionMin;
  const mark = ok ? "✅" : "❌";
  console.log(`${mark} "${c.message}" → ${JSON.stringify(b)}`);
  console.log(`   istagi: ${c.want}`);
  if (ok) pass++;
  else fail++;
}

console.log("");
console.log("=".repeat(60));
console.log("7️⃣ SEMANTIC TRAP / CONTRADICTION");
console.log("=".repeat(60));

for (const c of TRAP_CASES) {
  const intent = intentClassifier.classify(c.message);
  let profile: NonNullable<SessionContext["recommendationProfile"]> = {};
  profile = updateRecommendationProfile(profile, c.message, intent.entities);
  const cat = intent.entities?.institutionCategory;
  const catOk = c.expectCategory
    ? cat === c.expectCategory
    : c.expectNoCategory
      ? !cat
      : true;
  const admOk = c.expectAdmissionFailed ? profile.admissionFailed === true : true;
  const ok = catOk && admOk;
  const mark = ok ? "✅" : "❌";
  console.log(`${mark} "${c.message.substring(0, 60)}..."`);
  console.log(`   istagi: ${c.want}`);
  console.log(`   entities=${JSON.stringify(intent.entities)} | profile=${JSON.stringify(profile)}`);
  if (ok) pass++;
  else fail++;
}

console.log("");
console.log("=".repeat(60));
console.log("8️⃣ FOLLOW-UP BINDING — tavsiyadan keyin oldingi univga bog'lanish");
console.log("=".repeat(60));

{
  // lastRecommendations o'rnatilgan session — tavsiya berilgan, endi follow-up
  const session: any = {
    language: "uz",
    isGuest: false,
    recommendationProfile: { admissionFailed: true, interests: ["it"], city: "toshkent" },
    lastRecommendations: [{ id: 1, name: "Toshkent Amaliy Fanlar Universiteti", slug: "tafu" }],
  };
  const history: ChatMessage[] = [
    { id: "u0", role: "user", content: "Toshkent Amaliy Fanlar Universiteti", timestamp: new Date() },
    { id: "a0", role: "assistant", content: "tavsiya", intent: "recommendation", timestamp: new Date() },
  ];
  const f = augmentFollowUp(FOLLOW_UP_TURNS[1], session, history, "uz");
  const bound = f.effectiveMessage.toLowerCase().includes("toshkent amaliy");
  const mark = bound ? "✅" : "❌";
  console.log(`${mark} "${FOLLOW_UP_TURNS[1]}" → "${f.effectiveMessage}" (${f.intent.intent})`);
  console.log(`   istagi: tavsiya qilingan univga bog'lanishi kerak (lastRecommendations[0])`);
  if (bound) pass++;
  else fail++;
}

console.log("");
console.log("=".repeat(60));
console.log("9️⃣ NEGATIVE INTENT / SEMANTIC BOUNDARY");
console.log("=".repeat(60));

for (const c of NEGATIVE_CASES) {
  const intent = intentClassifier.classify(c.message);
  let profile: NonNullable<SessionContext["recommendationProfile"]> = {};
  profile = updateRecommendationProfile(profile, c.message, intent.entities);
  // YAKUNIY intent — isSituationalRecommendation override'dan keyin
  // ("men bankda ishlamoqchiman" → base=direction_search, final=recommendation)
  const overridden = isSituationalRecommendation(c.message, intent, undefined);
  const finalIntent = overridden ? "recommendation" : intent.intent;
  const cat = intent.entities?.institutionCategory;
  const catOk = c.expectCategory
    ? cat === c.expectCategory
    : c.expectNoCategory
      ? !cat
      : true;
  const intentOk = c.expectedIntent ? finalIntent === c.expectedIntent : true;
  const ok = catOk && intentOk;
  const mark = ok ? "✅" : "❌";
  console.log(`${mark} "${c.message}"`);
  console.log(`   istagi: ${c.want}`);
  console.log(`   base=${intent.intent} → final=${finalIntent} entities=${JSON.stringify(intent.entities)}`);
  if (ok) pass++;
  else fail++;
}

console.log("");
console.log("=".repeat(60));
console.log("🔟 HARD BUDGET FILTER (deterministik)");
console.log("=".repeat(60));

for (const c of HARD_BUDGET_CASES) {
  const unis = c.unis.map((u) => ({
    fullNameUz: u.name,
    minimal_tuition_fee: u.min,
    maximal_tuition_fee: u.max,
  }));
  const { kept, removedCount } = applyHardBudgetFilter(unis, { tuitionMax: c.tuitionMax, tuitionMin: c.tuitionMin });
  const keptNames = kept.map((u: any) => u.fullNameUz);
  const okKept = c.expectKept.every((n) => keptNames.includes(n));
  const okRemoved = c.expectRemoved.every((n) => !keptNames.includes(n));
  const ok = okKept && okRemoved;
  const mark = ok ? "✅" : "❌";
  console.log(`${mark} ${c.name}`);
  console.log(`   istagi: ${c.want}`);
  console.log(`   qolgan: [${keptNames.join(", ")}] | chiqarilgan: ${removedCount}`);
  if (ok) pass++;
  else fail++;
}

console.log("");
console.log("=".repeat(60));
console.log("1️⃣1️⃣ DECISION REGRESSION (admission + budget + direction)");
console.log("=".repeat(60));

for (const c of DECISION_CASES) {
  const routerD: any = new ToolRouter();
  const scored = c.unis.map((u) => {
    const uni = {
      fullNameUz: u.name,
      institutionCategoryId: u.institutionCategoryId,
      minimalTuitionFee: u.min,
      maximalTuitionFee: u.max,
      location_uz: u.location,
    };
    return { name: u.name, ...routerD.computeRecommendationScore(uni, c.preferences, u.dirs) };
  });
  scored.sort((a: any, b: any) => b.total - a.total);
  const best = scored[0];
  const bestUni = c.unis.find((u) => u.name === best.name)!;
  const bestIsState = bestUni.institutionCategoryId === 3;
  const okBest = best.name === c.expectBestName;
  const okNoState = c.expectNoStateFirst ? !bestIsState : true;
  const ok = okBest && okNoState;
  const mark = ok ? "✅" : "❌";
  console.log(`${mark} ${c.name}`);
  console.log(`   istagi: ${c.want}`);
  console.log(`   #1: ${best.name} (${best.total} ball) | kutilgan: ${c.expectBestName}`);
  scored.slice(0, 4).forEach((s: any) => console.log(`     - ${s.name}: ${s.total}`));
  if (ok) pass++;
  else fail++;
}

console.log("");
console.log("=".repeat(60));
console.log("1️⃣6️⃣ TOOL RESULT VALIDATION (result-validator)");
console.log("=".repeat(60));

for (const c of VALIDATION_CASES) {
  const v = validateRecommendationResults(
    c.unis.map((u) => ({
      name: u.name,
      institutionCategoryId: u.institutionCategoryId,
      institutionCategory: u.institutionCategory,
      minimalTuitionFee: u.min,
      maximalTuitionFee: u.max,
      location: u.location,
      matchedDirections: u.matchedDirections,
    })),
    c.preferences as any
  );
  const rejNames = v.rejected.map((r) => r.name);
  const downNames = v.downranked.map((r) => r.name);
  const accNames = v.accepted.map((r) => r.name);
  const okRej = c.expectRejected.every((n) => rejNames.includes(n));
  const okDown = c.expectDownranked.every((n) => downNames.includes(n));
  const okAcc = c.expectAccepted.every((n) => accNames.includes(n));
  const okCon = c.expectConstraint ? v.constraintsApplied.some((x) => x.includes(c.expectConstraint!)) : true;
  const ok = okRej && okDown && okAcc && okCon;
  const mark = ok ? "✅" : "❌";
  console.log(`${mark} ${c.name}`);
  console.log(`   istagi: ${c.want}`);
  console.log(`   qoidalar: ${v.constraintsApplied.join(" | ")}`);
  console.log(`   ACCEPT: [${accNames.join(", ")}]`);
  console.log(`   DOWNRANK: [${downNames.join(", ")}]`);
  console.log(`   REJECT: [${rejNames.join(", ")}]`);
  if (ok) pass++;
  else fail++;
}

console.log("");
console.log("=".repeat(60));
console.log("1️⃣4️⃣ MISSING INFO / CONFIDENCE (decision-engine)");
console.log("=".repeat(60));

for (const c of MISSING_INFO_CASES) {
  const intent = intentClassifier.classify(c.message);
  let profile: NonNullable<SessionContext["recommendationProfile"]> = {};
  profile = updateRecommendationProfile(profile, c.message, intent.entities);
  const overridden = isSituationalRecommendation(c.message, intent, profile);
  const finalIntent = overridden ? "recommendation" : intent.intent;
  const facts = deriveDecisionFacts(intent.entities, profile);
  const d = computeRecommendationDecision({ intent: finalIntent, intentConfidence: intent.confidence, ...facts, message: c.message });
  const intentOk = finalIntent === c.expectedIntent;
  const modeOk = d.mode === c.expectedMode;
  const missingOk = c.expectedMissing ? d.missing.slice().sort().join(",") === c.expectedMissing.slice().sort().join(",") : true;
  const toolOk = c.expectedNeedsTool !== undefined ? d.needsTool === c.expectedNeedsTool : true;
  const ok = intentOk && modeOk && missingOk && toolOk;
  const mark = ok ? "✅" : "❌";
  console.log(`${mark} "${c.message}"`);
  console.log(`   istagi: ${c.want}`);
  console.log(`   final=${finalIntent} mode=${d.mode} conf=${d.confidence.toFixed(2)} missing=[${d.missing}] tool=${d.needsTool}`);
  console.log(`   ${d.reason}`);
  if (ok) pass++;
  else fail++;
}

console.log("");
console.log("=".repeat(60));
console.log("1️⃣5️⃣ END-TO-END CONVERSATION (multi-turn qarorlar)");
console.log("=".repeat(60));

for (const c of CONVERSATION_CASES) {
  let profile: NonNullable<SessionContext["recommendationProfile"]> = {};
  const turnResults: string[] = [];
  let turnOk = true;
  for (const t of c.turns) {
    const intent = intentClassifier.classify(t.message);
    profile = updateRecommendationProfile(profile, t.message, intent.entities);
    const overridden = isSituationalRecommendation(t.message, intent, profile);
    const finalIntent = overridden ? "recommendation" : intent.intent;
    const facts = deriveDecisionFacts(intent.entities, profile);
    const d = computeRecommendationDecision({ intent: finalIntent, intentConfidence: intent.confidence, ...facts, message: t.message });
    let tOk = true;
    if (t.expectMode) tOk = tOk && d.mode === t.expectMode;
    if (t.expectIntent) tOk = tOk && finalIntent === t.expectIntent;
    if (t.expectProfile?.admissionFailed !== undefined) tOk = tOk && profile.admissionFailed === t.expectProfile.admissionFailed;
    if (t.expectProfile?.interests) tOk = tOk && t.expectProfile.interests.every((x) => profile.interests?.includes(x));
    if (t.expectProfile?.city !== undefined) tOk = tOk && profile.city === t.expectProfile.city;
    if (t.expectProfile?.budget !== undefined) tOk = tOk && profile.budget === t.expectProfile.budget;
    if (!tOk) turnOk = false;
    turnResults.push(`"${t.message}" → ${finalIntent}/${d.mode}${tOk ? "" : " ❌"}`);
  }
  const mark = turnOk ? "✅" : "❌";
  console.log(`${mark} ${c.name}`);
  console.log(`   istagi: ${c.want}`);
  turnResults.forEach((r) => console.log(`   ${r}`));
  console.log(`   yakuniy profil: ${JSON.stringify(profile)}`);
  if (turnOk) pass++;
  else fail++;
}

console.log("");
console.log("=".repeat(60));
console.log("1️⃣3️⃣ RECOMMENDATION QUALITY — to'g'ri universitеt tanlash");
console.log("=".repeat(60));

for (const c of QUALITY_CASES) {
  const routerQ: any = new ToolRouter();
  const unis = c.unis.map((u) => ({
    fullNameUz: u.name,
    institutionCategoryId: u.institutionCategoryId,
    minimalTuitionFee: u.min,
    maximalTuitionFee: u.max,
    location_uz: u.location,
  }));
  // 1) HARD FILTER — recommend() oqimidagi kabi (budget qat'iy)
  const { kept } = applyHardBudgetFilter(unis, {
    tuitionMax: c.preferences.tuitionMax as number | undefined,
    tuitionMin: c.preferences.tuitionMin as number | undefined,
  });
  const keptNames = kept.map((u: any) => u.fullNameUz);
  // 2) SCORING
  const scored = kept.map((u: any) => {
    const dirs = c.unis.find((cu) => cu.name === u.fullNameUz)?.dirs || [];
    return {
      name: u.fullNameUz,
      cat: universityCategoryRank(u),
      ...routerQ.computeRecommendationScore(u, c.preferences, dirs),
    };
  });
  scored.sort((a: any, b: any) => b.total - a.total || (b.breakdown?.quality || 0) - (a.breakdown?.quality || 0));
  // 3) QOIDALAR
  const checks: Array<[string, boolean]> = [];
  if (c.topIs) checks.push([`#1 = ${c.topIs}`, scored[0]?.name === c.topIs]);
  if (c.noStateFirst) checks.push(["#1 davlat EMAS", scored[0]?.cat !== "state"]);
  if (c.noStateFirst === false) checks.push(["#1 davlat bo'lishi mumkin", true]);
  if (c.topNPrivateOrIntl) {
    const topN = scored.slice(0, c.topNPrivateOrIntl);
    checks.push([`top-${c.topNPrivateOrIntl} hammasi xususiy/xalqaro`, topN.length > 0 && topN.every((s: any) => s.cat === "private" || s.cat === "international")]);
  }
  if (c.topExcludes) checks.push([`natijada yo'q: ${c.topExcludes.join(", ")}`, c.topExcludes.every((n) => !keptNames.includes(n))]);
  if (c.reasonsTop) {
    const r = (scored[0]?.reasons || []) as string[];
    const joined = r.join(" ").toLowerCase();
    checks.push(["#1 reasons bor", r.length > 0]);
    for (const pat of c.reasonsTop) {
      checks.push([`#1 reasons'da '${pat}'`, new RegExp(pat, "i").test(joined)]);
    }
  }
  const ok = checks.every(([, v]) => v);
  const mark = ok ? "✅" : "❌";
  console.log(`${mark} ${c.name}`);
  console.log(`   istagi: ${c.want}`);
  console.log(`   ranking: ${scored.map((s: any) => `${s.name}(${s.total})`).join(" → ") || "(bo'sh)"}`);
  console.log(`   #1 reasons: ${(scored[0]?.reasons || []).slice(0, 2).join(" | ") || "-"}`);
  for (const [name, v] of checks) {
    console.log(`   ${v ? "✅" : "❌"} ${name}`);
  }
  if (ok) pass++;
  else fail++;
}

console.log("");
console.log("=".repeat(60));
console.log("1️⃣7️⃣ EXPLANATION QUALITY — universitet sifati + 'nega aynan shu?' sabablari (STAGE 17)");
console.log("=".repeat(60));

// 17a) computeUniversityQuality unit testlari — REAL signal'lar faktga asoslangan ball beradi
interface QualitySignalCase {
  name: string;
  want: string;
  uni: Record<string, unknown>;
  expectMinScore: number;
  expectSignalPatterns: string[];
}

const QUALITY_SIGNAL_CASES: QualitySignalCase[] = [
  {
    name: "eski + katta + akkreditatsiya + hamkor + keng yo'nalish + grant → cap 15",
    want: "Tajriba(5) + talabalar(4) + akkreditatsiya(4) + hamkor(3) + kenglik(3) + grant(1) = 20 → cap 15; signal'lar faktga asoslangan",
    uni: { fullNameUz: "TATU", foundedYear: 1955, studentsCount: 12000, accreditationCertificate: "cert.pdf", isPartner: true, directionCount: 30, hasGrant: true },
    expectMinScore: 15,
    expectSignalPatterns: ["1955", "talaba", "akkreditatsiya"],
  },
  {
    name: "signal'lar yo'q → 0 ball (hech narsa o'ylab topilmaydi)",
    want: "Ma'lumot bo'lmasa LLM kabi to'qish yo'q — 0 ball, bo'sh signal'lar",
    uni: { fullNameUz: "Noma'lum Univ" },
    expectMinScore: 0,
    expectSignalPatterns: [],
  },
  {
    name: "yangi + kichik → past ball (faqat 2021 + 300 talaba)",
    want: "2021(+1) + 300 talaba(+1) = 2 — yangi va kichik universiteit pastroq sifat balli",
    uni: { fullNameUz: "Yangi Univ", foundedYear: 2021, studentsCount: 300 },
    expectMinScore: 1,
    expectSignalPatterns: ["2021"],
  },
];

for (const c of QUALITY_SIGNAL_CASES) {
  const q = computeUniversityQuality(c.uni);
  const scoreOk = q.score >= c.expectMinScore && q.score <= 15;
  const sigOk = c.expectSignalPatterns.every((p) => q.signals.some((s) => s.toLowerCase().includes(p.toLowerCase())));
  const ok = scoreOk && sigOk;
  const mark = ok ? "✅" : "❌";
  console.log(`${mark} ${c.name}`);
  console.log(`   istagi: ${c.want}`);
  console.log(`   score=${q.score}/15 | signals=${JSON.stringify(q.signals)}`);
  if (ok) pass++;
  else fail++;
}

// 17b) TIE-BREAK — policy'ga teng keladiganlar orasida sifat hal qiluvchi
interface QualityTieCase {
  name: string;
  want: string;
  unis: Array<{
    name: string;
    institutionCategoryId: number;
    min: number;
    max: number;
    location: string;
    dirs: string[];
    quality?: Record<string, unknown>;
  }>;
  preferences: Record<string, unknown>;
  topIs: string;
  reasonsTop?: string[];
}

const QUALITY_TIE_CASES: QualityTieCase[] = [
  {
    name: "policy'ga teng 2 univ → sifatli ustun chiqadi",
    want: "Ikkala univ ham xususiy + Toshkent + IT + 15-19 mln (policy bo'yicha teng) — bittasida sifat signal'lari (1992, 12 ming talaba, akkreditatsiya) → u #1",
    unis: [
      { name: "Sifatli Univ", institutionCategoryId: 4, min: 15000000, max: 19000000, location: "Toshkent", dirs: ["Data Science", "Kompyuter injiniringi"], quality: { foundedYear: 1992, studentsCount: 12000, accreditationCertificate: "cert.pdf" } },
      { name: "Oddiy Univ", institutionCategoryId: 4, min: 15000000, max: 19000000, location: "Toshkent", dirs: ["Data Science", "Kompyuter injiniringi"] },
    ],
    preferences: { directionCategory: "it", tuitionMax: 20000000, preferredCities: ["toshkent"], region: "14" },
    topIs: "Sifatli Univ",
    reasonsTop: ["yildan beri|tashkil etilgan", "talaba"],
  },
  {
    name: "yiqilgan user — davlat kuchli sifatga ega bo'lsa ham #1 bo'lmaydi",
    want: "TATU (1955, 12 ming talaba, akkreditatsiya, hamkor → sifat 15) — lekin davlat(-12); TAFU (xususiy, +20) — sifat pastroq bo'lsa ham admissionFailed policy ustun",
    unis: [
      { name: "TATU", institutionCategoryId: 3, min: 15000000, max: 19000000, location: "Toshkent", dirs: ["Data Science", "Sun'iy intellekt", "Kompyuter injiniringi", "Dasturiy injiniring"], quality: { foundedYear: 1955, studentsCount: 20000, accreditationCertificate: "cert.pdf", isPartner: true, directionCount: 40, hasGrant: true } },
      { name: "TAFU", institutionCategoryId: 4, min: 15000000, max: 19000000, location: "Toshkent", dirs: ["Data Science", "Kompyuter injiniringi"] },
    ],
    preferences: { admissionFailed: true, directionCategory: "it", tuitionMax: 20000000, preferredCities: ["toshkent"], region: "14" },
    topIs: "TAFU",
  },
];

for (const c of QUALITY_TIE_CASES) {
  const routerQ: any = new ToolRouter();
  const scored = c.unis.map((u) => {
    const uniObj = {
      fullNameUz: u.name,
      institutionCategoryId: u.institutionCategoryId,
      minimalTuitionFee: u.min,
      maximalTuitionFee: u.max,
      location_uz: u.location,
      ...(u.quality || {}),
    };
    return {
      name: u.name,
      cat: universityCategoryRank(uniObj),
      ...routerQ.computeRecommendationScore(uniObj, c.preferences, u.dirs),
    };
  });
  scored.sort((a: any, b: any) => b.total - a.total || (b.breakdown?.quality || 0) - (a.breakdown?.quality || 0));
  const checks: Array<[string, boolean]> = [];
  if (c.topIs) checks.push([`#1 = ${c.topIs}`, scored[0]?.name === c.topIs]);
  if (c.reasonsTop) {
    const r = (scored[0]?.reasons || []) as string[];
    const joined = r.join(" ").toLowerCase();
    checks.push(["#1 reasons bor", r.length > 0]);
    for (const pat of c.reasonsTop) {
      checks.push([`#1 reasons'da '${pat}'`, new RegExp(pat, "i").test(joined)]);
    }
  }
  const ok = checks.every(([, v]) => v);
  const mark = ok ? "✅" : "❌";
  console.log(`${mark} ${c.name}`);
  console.log(`   istagi: ${c.want}`);
  console.log(`   ranking: ${scored.map((s: any) => `${s.name}(${s.total})`).join(" → ")}`);
  console.log(`   #1 reasons: ${(scored[0]?.reasons || []).slice(0, 3).join(" | ") || "-"}`);
  for (const [name, v] of checks) {
    console.log(`   ${v ? "✅" : "❌"} ${name}`);
  }
  if (ok) pass++;
  else fail++;
}

console.log("");
console.log("=".repeat(60));
console.log("1️⃣2️⃣ ADVERSARIAL BOUNDARY (yo'q/lekin/faqat/ham/emas)");
console.log("=".repeat(60));

for (const c of ADVERSARIAL_CASES) {
  const intent = intentClassifier.classify(c.message);
  let profile: NonNullable<SessionContext["recommendationProfile"]> = {};
  profile = updateRecommendationProfile(profile, c.message, intent.entities);
  const overridden = isSituationalRecommendation(c.message, intent, undefined);
  const finalIntent = overridden ? "recommendation" : intent.intent;
  const intentOk = c.expectedIntent ? finalIntent === c.expectedIntent : true;
  const cat = intent.entities?.institutionCategory;
  const catOk = c.expectCategory
    ? cat === c.expectCategory
    : c.expectNoCategory
      ? !cat
      : true;
  const uniOk = c.expectNoUniversity ? !intent.entities?.university : true;
  const ok = intentOk && catOk && uniOk;
  const mark = ok ? "✅" : "❌";
  console.log(`${mark} "${c.message}"`);
  console.log(`   istagi: ${c.want}`);
  console.log(`   base=${intent.intent} → final=${finalIntent} entities=${JSON.stringify(intent.entities)}`);
  if (ok) pass++;
  else fail++;
}

console.log("");
console.log("=".repeat(60));
console.log("5️⃣ PROFILE MEMORY (multi-turn saqlanishi)");
console.log("=".repeat(60));

{
  let profile: NonNullable<SessionContext["recommendationProfile"]> = {};
  const turnResults: Array<{ msg: string; profile: Record<string, unknown> }> = [];
  for (const m of PROFILE_MEMORY_TURNS) {
    const intent = intentClassifier.classify(m);
    profile = updateRecommendationProfile(profile, m, intent.entities);
    turnResults.push({ msg: m, profile: { ...profile } });
  }

  const checks: Array<[string, boolean]> = [
    ["admissionFailed=true saqlanadi", profile.admissionFailed === true],
    ["interests=[it] saqlanadi", Array.isArray(profile.interests) && profile.interests.includes("it")],
    ["city=toshkent saqlanadi", profile.city === "toshkent"],
    ["budget=20000000 saqlanadi", profile.budget === 20000000],
    ["interestGrant=true saqlanadi", profile.interestGrant === true],
  ];
  for (const [name, ok] of checks) {
    const mark = ok ? "✅" : "❌";
    console.log(`${mark} ${name}`);
    if (ok) pass++;
    else fail++;
  }
  console.log(`   oxirgi profil: ${JSON.stringify(profile)}`);
}

async function main(): Promise<void> {
  if (LIVE_MODE) {
    await runLiveRecommendationTest();
  } else {
    console.log("");
    console.log("ℹ️ LIVE test o'tkazib yuborildi — ishga tushirish: npx tsx scripts/regression-intents.ts --live");
  }

  console.log("");
  console.log("=".repeat(60));
  console.log(`NATIJA: ${pass} o'tdi, ${fail} muvaffaqiyatsiz`);
  console.log("=".repeat(60));

  process.exit(fail > 0 ? 1 : 0);
}

void main();
