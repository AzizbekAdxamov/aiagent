/**
 * FOLLOW-UP CONTEXT MANAGER (BOSQICH 3)
 *
 * Session kontekstini to'playdi va qisqa follow-up so'rovlarga qo'shadi.
 * "Toshkentdagi universitetlar → ITlari → Davlatlari" zanjiri:
 *   1. "Toshkentdagi universitetlar"  → region=Toshkent saqlanadi
 *   2. "ITlari"                       → region + direction=IT qo'shiladi
 *   3. "Davlatlari"                   → region + direction + ownership=state
 *
 * Har bir so'rovda kontekst boyib boradi — foydalanuvchi qisqa so'zlar bilan
 * avvalgi so'rovni toraytiradi. Degree, language va byudjet ham follow-up'da
 * ishlatiladi (metadata'da saqlangan, lekin avval e'tiborsiz qoldirilgan edi).
 */

import type { ChatMessage, SessionContext, IntentResult } from "@/types";
import { intentClassifier } from "./intent-classifier";
import { lookupManager } from "@/data/lookups";
import { detectDirectionCategory, hasInterestPhrase, GENERIC_TOPIC_HEADING } from "./direction-synonyms";
import { getSelfCompleteIntents } from "./intent-config";
import { normalizeUserText } from "./text-normalizer";
import {
  extractUserProfile,
  // STAGE 14/14c: USER STATE extractorlari ENTITY-EXTRACTOR'da yagona manba
  // (barcha profile extractorlari shu modulda). Bu yerda faqat import qilinadi.
  extractAdmissionFailed,
  extractWantsToStudy,
} from "./entity-extractor";

export interface FollowUpResult {
  effectiveMessage: string;
  intent: IntentResult;
  augmented: boolean;
  additions: string[];
  /** Fix #34: foydalanuvchi universitеtni rad etdi, lekin nom bermadi —
   *  provider-manager qaysi universitеtni nazarda tutganini so'raydi. */
  clarifyUniversity?: boolean;
}

// STAGE 14/14c — USER STATE EXTRACTORLARI entity-extractor.ts da joylashgan
// (extractAdmissionFailed / extractWantsToStudy). Barcha profile extractorlari
// yagona manbada bo'lishi uchun shu yerga ko'chirildi — bu yerda faqat import.

/**
 * O'z-o'zidan to'liq bo'lgan (yangi mavzu ochuvchi) so'rovlar follow-up ga qo'shilmaydi.
 * BOSQICH 4 (JSON-driven config): ro'yxat intent-config.json dagi
 * selfComplete=true flag'idan o'qiladi — kodga tegmasdan boshqariladi.
 * Katalog intentlari (direction_list, university_list, grant_list, news_list)
 * va tuition_search o'z-o'zidan to'liq — ular kontekstga bog'lanmasligi kerak.
 */
export const NON_ENHANCE_INTENTS: string[] = getSelfCompleteIntents();

/**
 * STAGE 14c — SITUATIONAL RECOMMENDATION (TASK 2):
 * Recommendation vs Search ajratishi CONVERSATION CONTEXT + user vaziyatiga
 * asoslanadi — faqat kalit so'zlarga emas.
 *
 * Hozirgi xato (log): "imtihondan yiqildim" → "tibbiyotga qiziqaman,
 * Toshkentda yashayman" → direction_search + template ("Sizga mos
 * universitetlar") bo'lib qolardi. To'g'risi: user o'z vaziyatini aytib
 * MASLAHAT kutyapti → recommendation.
 *
 * Qoida: profile'da admissionFailed/wantsToStudy (yig'ilgan conversation
 * context) BOR bo'lsa VA hozirgi xabar qiziqish/maqsad/shahar bildirsa →
 * recommendation. Lekin:
 *   - Aniq university nomi so'ralgan bo'lsa → search ("TTA haqida ayt")
 *   - Aniq katalog so'rovi ("yo'nalishlari ro'yxati") → search
 *   - direction_detail ("davolash ishi haqida ko'proq ma'lumot") → search
 *
 * @returns true → intent recommendation ga o'tkazilishi kerak
 */
export function isSituationalRecommendation(
  message: string,
  intent: IntentResult,
  sessionContext: SessionContext | undefined
): boolean {
  // Data-search, admission va suhbat intent'larida ishlaydi. "imtihondan
  // yiqildim, o'qishni orzu qilaman" kabi xabarlar general_chat'ga tushadi
  // (ruhiy signal) — lekin unda o'qishni davom ettirish niyati ham bor, shuning
  // uchun vaziyat+qiziqish signali bo'lsa recommendation ga o'tkaziladi.
  // Boshqa aniq intent'lar (greeting, thanks, comparison...) o'z yo'liga qoladi.
  //
  // STAGE 14g: grant_search / university_list HAM qo'shildi — "Grantga ballim
  // yetmadi" yoki "Ballim yetmadi, xususiy universitetlar bormi?" kabi
  // xabarlar katalog javobi EMAS, vaziyat aytib maslahat kutishdir. Faqat
  // vaziyat (admissionFailed) BOR bo'lsa o'tkaziladi (GUARD 1.5) — "grantlar
  // bormi?" kabi oddiy katalog so'rovi katalog qoladi.
  const allowed = ["direction_search", "university_search", "admission", "faq", "unknown", "general_chat", "grant_search", "university_list"];
  if (!allowed.includes(intent.intent)) {
    return false;
  }

  // Apostrof normalizatsiyasi: jingalak (’, ‘) / teskari (`) → to'g'ri (').
  // Real foydalanuvchi "o’qimoqchiman" yozadi — regex'lar to'g'ri apostrof
  // bilan, shuning uchun avval bir xil shaklga keltiramiz.
  const m = normalizeUserText(message).replace(/[’‘`]/g, "'");

  // GUARD 1: aniq university nomi → o'sha univ haqida so'rov (search qoladi)
  // "Toshkent tibbiyot akademiyasida davolash ishi bormi?" → direction_search
  // STAGE 17 (blind): REFERENS sifatida ishlatilgan univ ("menga ham TATUga
  // o'xshash narsa kerak") — o'sha univ haqida emas, o'xshashlarini so'rash →
  // recommendation mumkin (classifier STRONG_REC_SIGNALS bilan allaqachon
  // recommendation qilgan bo'lsa ham bu yerda bloklanmasligi kerak).
  // STAGE 19 (adversarial): "TATU kabi kuchlisi" — universitеt REFERENS
  // (o'xshashini so'rayapti), o'sha univ haqida so'rov EMAS → recommendation.
  const referenceUni = /\b(shunga|unga|o'shanga|shunday|xuddi\s+shu)\s+o'xshash\b|\bunga\s+o'xshab\b|\b\w+\s+kabi\s+(?:kuchli\w*|yaxshi\w*|zo'r\w*|sifatli\w*|kattasi|shunday|o'xshash\w*)\b/i.test(m);
  // STAGE 18 (blind): "TATUga ballim yetmadi, boshqa variant" — universitеt
  // KIRISH MUMKIN BO'LMAGAN MAQSAD, so'rov mavzusi EMAS → recommendation.
  const failedTargetUni = intent.entities?.university && extractAdmissionFailed(m);
  if (intent.entities?.university && !referenceUni && !failedTargetUni) return false;

  // GUARD 1.5 (REVIEWER FIX): general_chat/unknown uchun entity talabi.
  // Intent-classifier'ning GENERAL_CHAT override'i ruhiy maslahatni qasddan
  // general_chat'ga yuboradi ("imtihondan yiqildim, o'qishni orzu qilaman.
  // Qanday maslahat berasiz?") — data tool'larini ishga tushirmaslik uchun.
  // Bu yerda uni recommendation'ga YUTIB YUBORISH noto'g'ri bo'lardi (recommend
  // tool clarifying savollar so'ray boshlaydi). Qoida: general_chat/unknown
  // faqat direction/region entity BOR bo'lgandagina recommendation'ga o'tadi —
  // "tibbiyotga qiziqaman" (direction bor) → recommendation, "Qanday maslahat
  // berasiz" (entity yo'q) → general_chat qoladi.
  if (intent.intent === "general_chat" || intent.intent === "unknown") {
    // Entity (yo'nalish/shahar) bor bo'lsa → recommendation mumkin ("tibbiyotga
    // qiziqaman" kabi). YOKI aniq o'qish istagi bo'lsa ("o'qimoqchiman",
    // "kirmoqchiman") → ham recommendation mumkin (user O'QISHNI davom
    // ettirishni xohlayapti, ruhiy maslahat so'ramayapti).
    // "orzu qilaman + qanday maslahat berasiz" (ruhiy maslahat) esa wantsToStudy
    // signali bermaydi → general_chat qoladi (reviewer fix).
    const hasEntity = !!intent.entities?.direction || !!intent.entities?.region || !!intent.entities?.university || !!intent.entities?.institutionCategory;
    const hasStudyIntent = extractWantsToStudy(m);
    // STAGE 18 (blind): "men davlatga kira olmadim, lekin yana davlatni
    // xohlayman" — general_chat'ning "olmadim" signali ruhiy maslahat EMAS,
    // user vaziyatini aytib yechim kutyapti → recommendation mumkin.
    const hasAdmissionSituation = extractAdmissionFailed(m);
    // STAGE 18 (blind): PROFILDA ANIQ YO'NALISH bor — user suhbat davomida
    // qiziqishini aytgan ("men doktor bo'lishni xohlayman"), keyin "nima
    // qilishim mumkin?" desa — ruhiy maslahat EMAS, o'sha yo'nalish bo'yicha
    // variantlar kutyapti → recommendation. Yo'nalishsiz (faqat yiqilish/orzu)
    // profil suhbat qoladi (ruhiy maslahat — reviewer fix).
    const hasProfileDirection = !!sessionContext?.recommendationProfile?.interests?.length || !!sessionContext?.recommendationProfile?.careerGoal;
    if (!hasEntity && !hasStudyIntent && !hasAdmissionSituation && !hasProfileDirection) return false;
  }

  // STAGE 14g GUARD: grant_search / university_list kabi KATALOG intent'lari
  // faqat xabarda vaziyat BOR bo'lsagina recommendation'ga o'tadi. "Grantlar
  // bormi?" (katalog so'rovi, vaziyatsiz) → katalog qoladi. "Grantga ballim
  // yetmadi" (vaziyat) → recommendation. Aks holda katalog javobi chiqib,
  // userning maslahat kutyotgani e'tiborsiz qolardi.
  if (intent.intent === "grant_search" || intent.intent === "university_list") {
    const hasSituationInMsg = extractAdmissionFailed(m);
    if (!hasSituationInMsg) return false;
  }

  // GUARD 2: aniq katalog/ro'yxat so'rovi → search qoladi
  // "Toshkentda tibbiyot yo'nalishi bormi?" / "yo'nalishlari ro'yxati"
  // STAGE 14g (reviewer fix): xabarning O'ZIDA vaziyat bo'lsa ("Ballim yetmadi,
  // xususiy universitetlar bormi?") katalog so'rovi EMAS — user vaziyatini
  // aytib maslahat kutyapti (recommendation). Faqat vaziyatsiz katalog so'rovi
  // search qoladi.
  const catalogLike = /\b(ro'yxati|katalogi|mavjud|mavjudmi|bormi\??|bormikan|nechta|qancha\s+(?:universitet|yo'nalish)|qaysi\s+(?:universitet|oliygoh)(?:lar|larida|laridan|lariga)?\s+bor)\b/i.test(m);
  if (catalogLike && !extractAdmissionFailed(m)) {
    return false;
  }

  // GUARD 3: direction_detail / batafsil ma'lumot so'rovi → search qoladi
  if (intent.entities?.queryType === "direction_detail" ||
      /\b(haqida\s+(?:ma'lumot|info|gapir|ayt|tushuntir|ber)|batafsil)\b/i.test(m)) {
    return false;
  }

  // Conversation context: oldingi xabarlardan yig'ilgan user vaziyati
  const profile = sessionContext?.recommendationProfile;
  const hasSituationContext =
    profile?.admissionFailed === true || profile?.wantsToStudy === true;

  // Qiziqish/maqsad signali — user maslahat kutyapti ("qiziqaman",
  // "xohlayman", "orzu qilaman", "bo'lmoqchiman"...)
  const hasInterestSignal =
    /\b(qiziqaman|qiziqtiradi|yoqadi|yaxshi\s+ko'raman|bo'lmoqchiman|o'qimoqchiman|o'rganmoqchiman|kirmoqchiman|xohlayman|xohlayapman|orzu\s+qilaman|maqsadim|ishlamoqchiman|ishlagim\s+keladi|ishlashni\s+(?:xohlayman|istayman|xohlayapman)|ishlamoqchi(?:man)?|topshirmoqchiman|topib\s+ber(?:ing)?|maslahat\s+(?:ber(?:ing)?|berasan|berasiz|qil(?:ing)?|qilasan|qilasiz)|nima\s+qilaman|nima\s+qilishim\s+(?:mumkin|kerak)|yordam\s+(?:ber(?:ing)?|berasiz|kerak|so'rayman)|shunga\s+yordam|taslim\s+bo'lmayman|urinaman|qayta\s+topshiraman|yana\s+urinaman|davom\s+ettirmoqchiman|o'qisam\s+bo'ladimi|o'qishim\s+mumkinmi|boshqa\s+variant|boshqa\s+bormi)\b/i.test(m);

  // Vaziyat bildiruvchi shahar iborasi: "Toshkentda yashayman", "Toshkent
  // shahrida" — user kontekstini to'ldiradi (maslahat signali bilan birga).
  // STAGE 14g: "Toshkentda qolmoqchiman" / "Toshkentda o'qimoqchiman" ham
  // shahar kontekstini beradi — "Tibbiyotga kira olmadim, Toshkentda
  // qolmoqchiman" recommendation bo'lishi kerak, direction_search emas.
  const hasLivingContext =
    /\b(yashayman|yashaymiz|yashayapman|joylashganman|kelganman|yashaydigan|qolmoqchiman|qolaman|qolishni\s+xohlayman)\b/i.test(m);

  // Hozirgi xabarning O'ZIDA ham vaziyat bo'lishi mumkin ("yiqildim, lekin
  // o'qimoqchiman") — profile yig'ilishidan oldin ham ishlashi uchun.
  const hasSituationInMsg = extractAdmissionFailed(m);

  // ASOSIY QAROR: conversation situation + interest/living → recommendation
  if (hasSituationContext && (hasInterestSignal || hasLivingContext)) return true;
  // Hozirgi xabarda vaziyat + qiziqish birga kelsa (profil hali bo'lmasa ham)
  if (hasSituationInMsg && hasInterestSignal) return true;
  // STAGE 18 (blind): vaziyat + ANIQ yo'nalish/kategoriya tanlovi → maslahat.
  // "kirolmadim, endi xususiyga o'taman" (vaziyat + kategoriya),
  // "yiqildim, tibbiyotga qiziqaman" (vaziyat + yo'nalish).
  if (hasSituationInMsg && (intent.entities?.direction || intent.entities?.institutionCategory)) return true;
  // STAGE 18 (blind): kasb ORZUSI — "maktab o'qituvchisi bo'lishni orzu
  // qilaman", "doktor bo'lishni orzu qilaman" → maslahat (katalog emas).
  const hasCareerDream = /\b(?:bo'lishni|bo'lishi|bo'laman)\s+orzu\s+qil(?:aman|adi|ganman)|\borzusi\b|\borzuim\b/i.test(m);
  if (hasCareerDream && (intent.entities?.direction || intent.entities?.careerGoal)) return true;
  // STAGE 14g: grant_search / university_list kabi KATALOG intent'larida xabarning
  // O'ZIDAGI vaziyat ("Grantga ballim yetmadi", "Ballim yetmadi, xususiy
  // bormi?") kifoya — qiziqish so'zi talab qilinmaydi. User katalog so'ramayapti,
  // vaziyatini aytib maslahat kutyapti. (GUARD 1.5 allaqachon vaziyatni
  // tekshirgan — bu yerda faqat katalog intent'lariga maxsus yo'l.)
  if (
    (intent.intent === "grant_search" || intent.intent === "university_list" || intent.intent === "university_search") &&
    hasSituationInMsg
  ) {
    return true;
  }

  // STAGE 15 (fix): "imtihondan o'tdim, qaysi universitet/yonalish tanlashni
  // bilmayman, shunga yordam ber" — user O'TGAN bo'lishi mumkin (admissionFailed
  // shart emas!) yoki yangi session (profil bo'sh). Lekin aniq o'qish/universitet
  // konteksti + yordam/bilmayman signali → user maslahat kutyapti, katalog emas.
  // FIX (STAGE 15b): "universitetga" / "universitetlar" kabi suffix'li
  // shakllar \buniversitet\b ga mos kelmaydi (\b "universitet" dan keyin
  // o'tmaydi) — "qaysi universitetga kirishni bilmay qoldim" recommendation
  // bo'lmay qolardi. \w* bilan barcha suffix'lar qamrab olinadi.
  const hasStudyHelpContext =
    /\b(universitet\w*|oliygoh\w*|institut\w*|o'qish\w*|yo'nalish\w*|yonalish\w*|tanlash\w*|imtihon\w*|qabul\w*)\b/i.test(m) &&
    /\b(yordam\w*|maslahat\w*|bilmayman|bilmayapman|bilmaymiz|bilmay\s+qoldim|tushuncham\s+yo'q|tushunmayapman|hech\s+narsa\s+bilmayman|umuman\s+bilmayman|nima\s+qilishimni\s+bilmayman|chalkash)\b/i.test(m);
  if (hasStudyHelpContext) return true;

  // STAGE 18 (blind): ANIQ VARIANT SO'ROVI — "unga ham topib ber", "menga
  // topib ber" — user o'z/yaqinlari uchun mos variant kutyapti (profil shart
  // emas): "xotinim ham o'qimoqchi, unga ham topib ber" → recommendation.
  if (/\btopib\s+ber(?:ing)?\b/i.test(m)) return true;

  // STAGE 18 (blind): QAYTA URINISH / DAVOM — "birinchi yil qoldim, qayta
  // topshiraman", "yana urinaman" — user taslim bo'lmayapti, yechim kutyapti.
  if (/\b(qayta\s+topshiraman|qayta\s+topshirish|yana\s+urinaman|yana\s+urinish|taslim\s+bo'lmayman|davom\s+ettirmoqchiman)\b/i.test(m)) return true;

  // STAGE 18 (blind): MOSLIK SO'ROVI — "muhandislikka yaraymanmi", "ITga
  // yaraymanmi" — yo'nalish mosligi haqida maslahat → recommendation.
  if (intent.entities?.direction && /\byarayman(?:mi)?\b/i.test(m)) return true;

  // STAGE 19 (adversarial): FIKR O'ZGARISHI — "IT emas, aslida iqtisodga
  // qiziqaman, oldingi gapimni unut" — user oldingi tanlovini INKOR qilib,
  // yangi yo'nalishni bildirmoqda → maslahat (yangisiga mos variantlar).
  if (intent.entities?.direction && /\b(aslida|endi|hozir)\b/i.test(m) && /\b\w+\s+emas\b/i.test(m)) return true;

  // STAGE 19 (adversarial): SHARTLI VARIANT SO'ROVI — "yaxshi universitet
  // bo'lsa ayt", "variant bo'lsa ko'rsat", "kuchlisi bo'lsa ko'raman" — user
  // mos variant kutyapti → recommendation (katalog emas).
  if (/\b(universitet|oliygoh|variant|joy|imkoniyat|kuchli)\w*\b[^.!?]{0,40}\b(bo'lsa\s+(?:ayt|ko'rsat|ber|top|ko'raman|qarayman)|bo'lsa\s+ham\s+bo'ladi)\b/i.test(m)) return true;

  // STAGE 15 (fix): "bankda ishlagim keladi, Toshkentda yashayman, budget 25
  // mln" — user aniq SHAXSIY TAVSIYA so'rayapti (maqsad + shahar + budget),
  // katalog emas. Admission vaziyati (yiqilgan) shart EMAS — o'tgan user ham
  // tavsiya kutyapti. Maqsad signali + shahar/budget → recommendation.
  const hasGoalSignal =
    /\b(ishlagim\s+keladi|ishlamoqchiman|ishlamoqchi|ishlasam|bo'lmoqchiman|o'qimoqchiman|kirmoqchiman|qiziqaman|o'rganmoqchiman|xohlayman)\b/i.test(m) ||
    !!intent.entities?.careerGoal;
  const hasContextSignal =
    /\b(yashayman|yashayapman|yashaymiz|turuvchi|joylashgan)\b/i.test(m) ||
    /\b(budjet(?:im)?|byudjet(?:im)?|to'lay\s+olaman|pul(?:im)?\s+yetadi|kontrakt(?:im)?)\b/i.test(m);
  if (hasGoalSignal && hasContextSignal) return true;
  // STAGE 15d (semantic boundary): kasbiy maqsad YOLG'IZ O'ZI ham recommendation
  // signal — "men bankda ishlamoqchiman" (maslahat kutyapti, katalog emas).
  // FAKT so'rovi bo'lmasa ("kontrakti/narxi/qancha" → tuition_search qoladi):
  // "bank ishi kontrakti qancha?" → tuition_search, "TDIUda bank ishi bormi?"
  // → direction_search (university guard allaqachon qaytargan).
  const hasCareerOnly = /\b(ishlagim\s+keladi|ishlamoqchiman|ishlamoqchi|bo'lmoqchiman|bo'lmoqchi|bo'lishni\s+(?:xohlayman|istayman))\b/i.test(m);
  const hasFactQuery = /\b(kontrakt|narx|narh|to'lov|qancha|bormi|nechta|gacha)\b/i.test(m);
  if (hasCareerOnly && !hasFactQuery && !intent.entities?.university) return true;

  // STAGE 18 (blind): VERGULLI PREFERENCE RO'YXATI — "tibbiyot, Toshkent,
  // yotoqxona kerak", "20 mln, xususiy, IT" — direction + (shahar/kategoriya/
  // budget/yotoqxona) vergul bilan sanalgan → katalog so'rovi EMAS, user o'z
  // afzalliklarini aytib mos variant kutyapti → recommendation.
  // Katalog so'rovlari ("... bor bormi", "... yo'nalishi bor univlar") vergulsiz
  // yoki bormi/nechta bilan keladi — ular GUARD 2'da search qoladi.
  if ((intent.intent === "direction_search" || intent.intent === "university_search") && intent.entities?.direction && /,\s*/.test(m)) {
    const hasPrefSignal =
      !!intent.entities?.region || !!intent.entities?.institutionCategory ||
      intent.entities?.tuitionMax !== undefined || !!intent.entities?.accommodation;
    if (hasPrefSignal) return true;
  }

  return false;
}

/**
 * PROFILE BUILDER — har bir xabardagi ma'lumotlarni session profile'ga qo'shadi.
 *
 * Dialog zanjiri:
 *   1. "Buxoro viloyatidanman, AI + tibbiyotga qiziqaman, C1, 18 mln, Toshkent yoki Samarqand"
 *      → profile: { city: "buxoro", interests: ["ai", "tibbiyot"], englishLevel: "C1",
 *                   budget: 18000000, preferredCities: ["toshkent", "samarqand"] }
 *   2. "Grant ham bo'lsa yaxshi"
 *      → profile: { ...oldingi, interestGrant: true }
 *   3. "Xalqaro diplom ham kerak"
 *      → profile: { ...oldingi, wantsInternational: true }
 *
 * Bu funksiya provider-manager'da har xabar olganda chaqiriladi.
 */
export function updateRecommendationProfile(
  currentProfile: NonNullable<SessionContext["recommendationProfile"]>,
  userMessage: string,
  entities: IntentResult["entities"]
): NonNullable<SessionContext["recommendationProfile"]> {
  const profile = { ...currentProfile };

  // Profil extractor — bir xabardagi barcha ma'lumotlarni ajratadi
  const extracted = extractUserProfile(userMessage);

  // Qiziqishlar / interests: direction entity yoki yo'nalish sinonimi
  // STAGE 19 (adversarial): FIKR O'ZGARISHI — "aslida IT emas, tibbiyotga
  // qiziqaman" — eski yo'nalish O'RNIGA yangisi yoziladi (append emas):
  // interests=[tibbiyot] (IT yo'qoladi). "ITga qiziqaman" (oddiy bayon) esa
  // append bo'ladi.
  if (entities?.direction) {
    const isChangeOfMind = /\b\w+\s+emas\b/.test(userMessage) && /\b(aslida|endi|hozir)\b/.test(userMessage);
    if (isChangeOfMind) {
      profile.interests = [entities.direction];
    } else {
      const existing = profile.interests || [];
      if (!existing.includes(entities.direction)) {
        profile.interests = [...existing, entities.direction];
      }
    }
  }

  // Kasbiy maqsad: "AI yordamida tibbiyotda" → ai_medicine
  if (extracted.careerGoal && !profile.careerGoal) {
    profile.careerGoal = extracted.careerGoal;
  }

  // Ingliz darajasi: "C1", "IELTS 7", "B2"
  if (extracted.englishLevel && !profile.englishLevel) {
    profile.englishLevel = extracted.englishLevel;
  }

  // Byudjet: aniq son (18 mln) yoki daraja (low/mid/high)
  if (extracted.budget && !profile.budget) {
    profile.budget = extracted.budget;
    // Daraja ham belgilaymiz
    if (!profile.budgetLevel) {
      if (extracted.budget < 20_000_000) profile.budgetLevel = "low";
      else if (extracted.budget < 50_000_000) profile.budgetLevel = "mid";
      else profile.budgetLevel = "high";
    }
  }

  // Afzal shaharlar: "Toshkent yoki Samarqand" → ["toshkent", "samarqand"]
  if (extracted.preferredCities && extracted.preferredCities.length > 0) {
    const existing = profile.preferredCities || [];
    for (const c of extracted.preferredCities) {
      if (!existing.includes(c)) existing.push(c);
    }
    profile.preferredCities = existing;
  }

  // Zaif fanlar: "matematikam zaif"
  if (extracted.weaknesses && extracted.weaknesses.length > 0) {
    const existing = profile.weaknesses || [];
    for (const w of extracted.weaknesses) {
      if (!existing.includes(w)) existing.push(w);
    }
    profile.weaknesses = existing;
  }

  // Grant, yotoqxona, xalqaro diplom
  if (extracted.wantsGrant) profile.interestGrant = true;
  if (extracted.wantsHostel) profile.wantsHostel = true;
  if (extracted.wantsInternational) profile.wantsInternational = true;

  // Xorijga ketish niyati: "xorijda ishlash"
  if (/\b(xorijga ketmoqchi|chet\s*elda\s+ishlash|abroad|xorijiy|xorijda)\b/i.test(userMessage)) {
    profile.wantsForeign = true;
  }

  // STAGE 14 — USER STATE: "imtihondan yiqildim", "o'qishga kira olmadim",
  // "ballim yetmadi" → admissionFailed=true. Keyingi tavsiyalar xususiy
  // univlarni birinchi o'ringa chiqaradi (davlat emas) — user explicit
  // ravishda davlat so'ramasa (explicit request > avtomatik inference).
  // Flag'lar entity-extractor.extractUserProfile orqali keladi (yagona manba).
  if (extracted.admissionFailed) {
    profile.admissionFailed = true;
    console.log(`[UserState] admissionFailed=true ("${userMessage.substring(0, 60)}")`);
  }

  // STAGE 14c — USER STATE: "o'qimoqchiman", "kirmoqchiman", "o'qishni
  // xohlayman" → wantsToStudy=true. admissionFailed bilan birga yig'iladi —
  // "imtihondan yiqildim, lekin o'qishni xohlayman" vaziyati shakllanadi.
  if (extracted.wantsToStudy) {
    profile.wantsToStudy = true;
    console.log(`[UserState] wantsToStudy=true ("${userMessage.substring(0, 60)}")`);
  }

  // Region: entities'dan kelgan region → home city
  if (entities?.region && !profile.city) {
    // Region ID → city nomi (rough mapping)
    const REGION_NAMES: Record<string, string> = {
      "1": "qoraqalpogiston", "2": "andijon", "3": "buxoro", "4": "jizzax",
      "5": "qashqadaryo", "6": "navoiy", "7": "namangan", "8": "samarqand",
      "9": "surxondaryo", "10": "sirdaryo", "11": "toshkent", "12": "fargona",
      "13": "xorazm", "14": "toshkent",
    };
    profile.city = REGION_NAMES[entities.region] || entities.region;
  }

  return profile;
}


/** Matnda hudud (viloyat/shahar) eslatib o'tilganmi? */
export function hasRegionMention(message: string): boolean {
  return /\b(?:toshkent(?:da|dagi|ga|dan|ning|ni|a)?|samarqand(?:da|dagi|ga|dan|ning|ni|a)?|buxoro(?:da|dagi|ga|dan|ning|ni|a)?|andijon(?:da|dagi|ga|dan|ning|ni|a)?|farg(?:'ona|ona)(?:da|dagi|ga|dan|ning|ni|a)?|namangan(?:da|dagi|ga|dan|ning|ni|a)?|qarshi(?:da|dagi|ga|dan|ning|ni|a)?|urganch(?:da|dagi|ga|dan|ning|ni|a)?|nukus(?:da|dagi|ga|dan|ning|ni|a)?|jizzax(?:da|dagi|ga|dan|ning|ni|a)?|navoiy(?:da|dagi|ga|dan|ning|ni|a)?|xorazm(?:da|dagi|ga|dan|ning|ni|a)?|sirdaryo(?:da|dagi|ga|dan|ning|ni|a)?|surxondaryo(?:da|dagi|ga|dan|ning|ni|a)?)\b/i.test(message);
}

/**
 * Matnda kategoriya (davlat/xususiy/xalqaro) eslatib o'tilganmi?
 * MUHIM: egalik/ko'plik shakllari ham qo'llab-quvvatlanadi:
 * "davlatlari", "xususiylari", "xalqarolari", "davlatlarning" kabi.
 */
export function hasCategoryMention(message: string): boolean {
  return /\b(?:davlat|xususiy|xalqaro|nodavlat|public|private|state|international)(?:lar|lari|larning|larining|larida|laridan|lariga|ning|ni|da|dan|dagi|ga)?\b/i.test(message);
}

/** Matnda yo'nalish kategoriyasi sinonimi eslatib o'tilganmi? (suffix-tolerant) */
export function hasDirectionMention(message: string): boolean {
  return detectDirectionCategory(message) !== null;
}

/** Matnda daraja (bakalavr/magistr/doktorantura) eslatib o'tilganmi? */
export function hasDegreeMention(message: string): boolean {
  return /\b(?:bakalavr|bachelor|magistr|master|magistratura|doktorantura|phd)(?:lar|lari|larning|ning|ni|ga|da|dan)?\b/i.test(message);
}

/** Matnda ta'lim tili eslatib o'tilganmi? */
export function hasLanguageMention(message: string): boolean {
  return /\b(?:ingliz|english|rus|russian|o'zbek|uzbek)(?:cha(?:si|siga|sida|sini|sidan)?|da|dan|ga|ning|ni|lar|lari|larining|larida|laridan|lariga)?\b/i.test(message);
}

/** Matnda byudjet (narx/kontrakt/miqdor) eslatib o'tilganmi? */
export function hasBudgetMention(message: string): boolean {
  return /\b(?:\d+(?:\.\d+)?\s*(?:mln|million|milyon)|gacha|kontrakt|narx|narh|to'lov|tuition|price)\b/i.test(message);
}

export function getInstitutionCategoryLabel(categoryId: string): string | null {
  if (categoryId === "3") return "davlat";
  if (categoryId === "4") return "xususiy";
  if (categoryId === "5") return "xalqaro";
  return null;
}

/** Degree entity → o'zbekcha label (follow-up matniga qo'shish uchun) */
function getDegreeLabel(degree: string, language: "uz" | "ru" | "en"): string | null {
  if (degree === "bachelor") return language === "uz" ? "bakalavr" : "bachelor";
  if (degree === "master") return language === "uz" ? "magistratura" : "master";
  if (degree === "phd") return language === "uz" ? "doktorantura" : "phd";
  if (degree === "transfer") return language === "uz" ? "ko'chirish" : "transfer";
  return null;
}

/** Language entity → label (follow-up matniga qo'shish uchun) */
function getLanguageLabel(language: string, lang: "uz" | "ru" | "en"): string | null {
  if (language === "english") return lang === "uz" ? "ingliz" : "english";
  if (language === "russian") return lang === "uz" ? "rus" : "russian";
  if (language === "uzbek") return lang === "uz" ? "o'zbek" : "uzbek";
  return null;
}

/** Byudjet entity → matn ("20 mln gacha", "15 mln dan yuqori") */
function formatBudget(ctx: SessionContext): string | null {
  if (ctx.currentTuitionMax !== undefined && ctx.currentTuitionMin !== undefined) {
    return `${Math.round(ctx.currentTuitionMin / 1_000_000)} mln dan ${Math.round(ctx.currentTuitionMax / 1_000_000)} mln gacha`;
  }
  if (ctx.currentTuitionMax !== undefined) {
    return `${Math.round(ctx.currentTuitionMax / 1_000_000)} mln gacha`;
  }
  if (ctx.currentTuitionMin !== undefined) {
    return `${Math.round(ctx.currentTuitionMin / 1_000_000)} mln dan yuqori`;
  }
  return null;
}

/**
 * Follow-up mavzusini aniqlaydi: sessionContext.currentTopicName dan,
 * yoki (bo'lmasa) conversation history dagi oxirgi assistant sarlavhasidan.
 * MUHIM: shablon sarlavhalari ("Sizga eng yaxshi variantni topaman!") mavzu
 * bo'lib qolmasligi kerak — GENERIC_TOPIC_HEADING bilan filter qilinadi.
 */
export function extractTopicName(
  sessionContext: SessionContext | undefined,
  conversationHistory: ChatMessage[]
): string | undefined {
  let topicName = sessionContext?.currentTopicName as string | undefined;
  if (topicName && GENERIC_TOPIC_HEADING.test(topicName)) {
    topicName = undefined;
  }
  if ((!topicName || topicName.length <= 3) && conversationHistory?.length > 0) {
    const lastAsst = [...conversationHistory].reverse().find((m) => m.role === "assistant");
    if (lastAsst?.content) {
      const cleanHeading = (value?: string) =>
        value
          ?.replace(/^[^\p{L}\p{N}'"`]+/u, "")
          .replace(/\s+(haqida|yo'nalishlari|universitetlari|ro'yxati|kontrakt narxi|kontrakti|narxi)\s*$/i, "")
          .trim();
      topicName = cleanHeading(lastAsst.content.match(/^#{1,3}\s*(?:📚\s*)?(.+?)\s+yo'nalishlari(?:\n|$)/im)?.[1])
        || cleanHeading(lastAsst.content.match(/^#{1,3}\s*(?:🏛\s*)?(.+?)(?:\n|$)/m)?.[1]);
      if (topicName && GENERIC_TOPIC_HEADING.test(topicName)) {
        topicName = undefined;
      }
    }
  }
  return topicName;
}

/**
 * ContextResolver orqali qo'shilgan university nomidan kelib chiqqan SPURIOUS
 * entity'larni tozalaydi (Fix 19).
 *
 * Misol: "Toshkent Kimyo xalqaro universiteti Kontrakt narxi qancha?" degan
 * effective message'ni qayta klassifikatsiya qilganda university'ning O'Z
 * NOMIDAGI so'zlar noto'g'ri entity'larga aylanadi:
 *   - "kimyo"     → direction: "muhandislik"
 *   - "xalqaro"   → institutionCategory: "5" (KIUT aslida XUSUSIY=4!)
 *   - "toshkent"  → region: "14"
 * Bu filterlar searchTuition/searchUniversity'da university'ni chiqarib
 * tashlab, "topilmadi" javobiga olib keladi (KIUT cat 5 emas, 4 — filter
 * noto'g'ri exclude qiladi).
 *
 * University entity ANIQ bo'lsa, bu qo'shimcha filterlar zararli — user
 * ularni so'ramagan. Saqlanadi: university + accommodation (userning asl
 * savolidan: "yotoqxonasi bormi?" → accommodation=true).
 */
function sanitizeResolvedUniversityEntities(entities: IntentResult["entities"]): IntentResult["entities"] {
  if (!entities) return entities;
  const {
    direction,
    institutionCategory,
    institutionCategories,
    region,
    degree,
    language,
    educationType,
    ...rest
  } = entities;
  // REVIEWER FIX: tuitionMin/tuitionMax SAQLANADI — ular university nomidan
  // EMAS, userning o'z xabaridan keladi ("kontrakti 20 mln gachami?").
  // University nomlarida pul miqdori deyarli uchramaydi, budget filter esa
  // qimmatli — o'chirish xato bo'lardi.
  return rest;
}

/**
 * CONTEXT RESOLVER — oxirgi muhokama qilingan universitetni topadi (Fix 19).
 *
 * "TATU haqida ayt → Rektori kim?" zanjiri uchun Context Resolver bosqichi:
 * foydalanuvchi qisqa "attribut" savol berganida (telefon, manzil, rektor,
 * grant, qabul, yotoqxona...) va university entity bo'lmasa — oxirgi
 * eslatilgan universitet nomi qaytariladi. Manbalar tartibi:
 *   1. sessionContext.currentTopicName (eng ishonchli — university nomi)
 *   2. conversation history dagi oxirgi assistant sarlavhasi (## 🏛 Nom)
 *   3. conversation history dagi oxirgi user xabaridagi "…universiteti"
 *
 * Faqat UNIVERSITETGA O'XSHASH nomlar qaytariladi — region/yo'nalish topic
 * nomlari ("Toshkent shahri", "IT yo'nalishlari") qaytarilmaydi.
 */
export function findLastMentionedUniversity(
  sessionContext: SessionContext | undefined,
  conversationHistory: ChatMessage[]
): string | undefined {
  const looksLikeUniversity = (name: string | undefined): name is string => {
    if (!name || name.length <= 3) return false;
    // MUHIM (reviewer fix): GENERIC sarlavhalar ("Universitetlar ro'yxati",
    // "O'zbekistondagi universitetlar") ham "universitet" so'zini o'z ichiga
    // oladi — ularni university deb QABUL QILMASAK kerak, aks holda ro'yxat
    // javobidan keyin "kontrakti qancha?" "Universitetlar ro'yxati" nomini
    // prepend qilib, university topilmay qolardi (extractTopicName'dagi kabi).
    if (GENERIC_TOPIC_HEADING.test(name)) return false;
    // Qisqartma (TTA, TATU, INHA, WIUT...) yoki nomda OTM so'zi bor
    if (/^[A-Z]{2,6}$/.test(name)) return true;
    return /(universitet|university|institut|institute|akademiya|academy|oliygoh|college|texnikum)/i.test(name);
  };

  // 1) Session topic
  const topic = sessionContext?.currentTopicName as string | undefined;
  if (looksLikeUniversity(topic)) return topic;

  // 2) History — oxirgi assistant sarlavhasi
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const m = conversationHistory[i];
    if (m.role === "assistant" && m.content) {
      const cleanHeading = (value?: string) =>
        value
          ?.replace(/^[^\p{L}\p{N}'"`]+/u, "")
          .replace(/\s+(haqida|yo'nalishlari|universitetlari|ro'yxati|kontrakt narxi|kontrakti|narxi)\s*$/i, "")
          .trim();
      const h = cleanHeading(m.content.match(/^#{1,3}\s*(?:🏛|💰)?\s*(.+?)(?:\n|$)/m)?.[1]);
      if (looksLikeUniversity(h)) return h;
    }
    // 3) History — oxirgi user xabaridagi "…universiteti"
    if (m.role === "user" && m.content) {
      const nameMatch = m.content.match(/([^\n]{3,60}?)\s+(universiteti?|instituti?|akademiyasi?|oliygohi?)(da|ning|ga|ni|dan|dagi)?\b/i);
      if (nameMatch && nameMatch[1] && !/\b(nechta|qanday|barcha|jami|qaysi)\b/i.test(nameMatch[1])) {
        const name = `${nameMatch[1].trim()} ${nameMatch[2]}`;
        if (looksLikeUniversity(name)) return name;
      }
    }
  }
  return undefined;
}

/**
 * Follow-up so'rovni session konteksti bilan boyitadi.
 *
 * Zanjir:
 *   "Toshkentdagi universitetlar" (region=14 saqlanadi)
 *   → "ITlari"  → "Toshkent itlari"  (region + direction)
 *   → "Davlatlari" → "Toshkent it davlatlari" (region + direction + category)
 *
 * @returns effectiveMessage (boyitilgan matn), intent (qayta klassifikatsiya),
 *          augmented (boyitildimi), additions (qo'shilgan so'zlar)
 */
export function augmentFollowUp(
  userMessage: string,
  sessionContext: SessionContext | undefined,
  conversationHistory: ChatMessage[],
  language: "uz" | "ru" | "en" = "uz"
): FollowUpResult {
  let intent = intentClassifier.classify(userMessage);
  let effectiveMessage = userMessage;

  const wordCount = userMessage.trim().split(/\s+/).length;
  const isTopicSwitch = !!intent.entities?.university;

  // CONVERSATION REPAIR (BOSQICH 13): "Yo'q, men EMUni aytgandim" /
  // "Yo'q, TATUni nazarda tutdim" — foydalanuvchi xotirani tuzatadi.
  // University entity aniq bo'lsa, lastUniversity shu nomga almashtiriladi
  // va keyingi barcha follow-up so'rovlar (kontrakti/telefoni/batafsil)
  // shu yangi univga bog'lanadi.
  // GUARD: "yo'q" so'zi keng qo'llaniladi ("yo'q, xususiy kerak" — category
  // javob), lekin university entity BO'LMASA repair trigger bo'lmaydi.
  const isRepairIntent =
    /^(yo'q|emas|yoq|not)\b/i.test(userMessage.trim()) || /nazarda tut/i.test(userMessage);
  if (isRepairIntent) {
    // Qisqartma/universitet nomini SUFFIX bilan topish ("EMUni", "TATUni",
    // "EMU universitetini") — classifier'ning \b(EMU)\b regex'i suffix'li
    // shakllarga mos kelmaydi (\b "EMUni" da EMU dan keyin bo'lmaydi).
    // Real foydalanuvchi aynan shunday yozadi: "Yo'q, men EMUni aytgandim".
    const repairShort = userMessage.match(
      /\b(EMU|TATU|PDP|INHA|WIUT|TUIT|TTA|TTPI|TATI|TMI|TQI|SamDU|ADU|BuxDU|FarDU|NamDU|UrDU|QarDU|AndDU|TerDU|JDPU|TDPU|ToshDTU|ToshKEU|TKXU|TKTU|TDTU|TDIU|TDYU|ToshFA|ToshSEI|MIS|MESI|amity|westminster|akfa\s*med(?:line)?)(?:ni|ning|ga|da|dan|sini|sining)?\b/i
    );
    // REVIEWER FIX: to'liq nom regex'i xavfli — "Yo'q, Toshkentdagi davlat
    // universiteti kerak" (yangi so'rov) yoki "Yo'q, men Toshkent tibbiyot
    // akademiyasini aytgandim" ("men" olmoshi nomga qo'shilib qoladi) kabi
    // hollarda noto'g'ri nom topishi mumkin. Shuning uchun faqat ANIQ tuzatish
    // iboralari (aytgandim / demoqchi edim / nazarda tutdim / shuni emas, X)
    // bilan birga kelgandagina to'liq nom olinadi.
    const isFullRepairPhrase = /(aytgandim|demoqchi edim|nazarda tut|nazarda tutdim|shuni emas|uni emas|o'sha emas)/i.test(userMessage);
    const repairFull = isFullRepairPhrase
      ? userMessage.match(
          /([A-Za-zÀ-ž0-9'’ -]{3,40}?)\s+((?:universitet|university|institut|akademiya|oliygoh)(?:i|ini|ni|ning|si|sini|sining|ida|idagi|da|dagi|ga|dan)?)\b/i
        )
      : null;
    // REVIEWER FIX: "emas/kerak emas" — foydalanuvchi universitetni RAD
    // etmoqda ("Yo'q, PDP kerak emas"), repair emas. Nomdan keyin negativ
    // keladigan so'rov repair bo'lmasin.
    const isRejection =
      /(emas|kerak emas|yoq|keragi yo'q)\b/i.test(userMessage) &&
      !/aytgandim|nazarda tut/.test(userMessage);
    // REVIEWER FIX: to'liq nomdan olmoshlarni/negativlarni olib tashlash —
    // "Yo'q, men Toshkent tibbiyot akademiyasini aytgandim" da match
    // "men Toshkent tibbiyot" bo'lib qoladi, "men" nomga qo'shilmasligi kerak.
    const repairNamePart = repairFull
      ? repairFull[1].trim().replace(/^(men|mening|menga|menimcha|biz|siz|yo'q|emas|not|u|bu|shu|o'sha|mana)\s+/i, "").trim()
      : "";
    // REVIEWER FIX (Fix #34): "boshqa/o'zga/yana bir" kabi GENERIC so'zlar
    // haqiqiy nom EMAS — "Yo'q, boshqa universitetni nazarda tutgandim" da
    // repairFull "boshqa universitet"ni nom deb topib, yolg'on lastUniversity
    // yozib qo'yishi mumkin edi. Bunday holatda nom bo'sh hisoblanadi →
    // pastdagi REPAIR-CLARIFICATION bloki qaysi universitеt so'raydi.
    const repairFullName =
      repairFull && repairNamePart && !/^(boshqa|boshqasi|boshqasini|o'zga|o'zgasi|yana bir|boshqa bir)$/i.test(repairNamePart)
        ? `${repairNamePart} ${repairFull[2].trim()}`
        : "";
    const repairName =
      intent.entities?.university ||
      (repairShort?.[1]?.trim().toUpperCase() || "") ||
      repairFullName;
    if (repairName && !isRejection) {
      const repairUni = String(repairName);
      if (sessionContext) {
        // id: 0 — hali hal qilinmagan id; keyingi tool ishlaganda
        // rememberUniversity haqiqiy id/nom bilan almashtiradi.
        sessionContext.lastUniversity = { id: 0, name: repairUni, slug: undefined };
      }
      console.log(`[Repair] lastUniversity → "${repairUni}" ("${userMessage}")`);
      effectiveMessage = `${repairUni} haqida batafsil ma'lumot ber`;
      intent = intentClassifier.classify(effectiveMessage);
      intent = { ...intent, entities: sanitizeResolvedUniversityEntities(intent.entities) };
      const repairEntities = { ...intent.entities };
      if (!repairEntities.university || repairEntities.university.length < repairUni.length) {
        repairEntities.university = repairUni;
      }
      intent = { ...intent, entities: repairEntities };
      return { effectiveMessage, intent, augmented: true, additions: [repairUni] };
    }

    // REPAIR-CLARIFICATION (Fix #34): foydalanuvchi oldingi universitеtni RAD
    // etdi, lekin yangi nom bermadi ("Yo'q, boshqa universitet", "Yo'q, boshqa
    // bir variant", "boshqasini aytgandim"). Yangi nom yo'q → qaysi
    // universitеtni nazarda tutganini so'raymiz (taxmin qilmaymiz — aks holda
    // eski universitеt kartasi takrorlanib, user "yana o'sha" deb qolardi).
    // "Yo'q, rahmat" kabi suhbat xabarlari clarify EMAS — suhbat so'zlari
    // bo'lsa o'tkazib yuboramiz. Result flag: clarifyUniversity=true →
    // provider-manager universityClarificationResponse qaytaradi.
    const isConversationalRepair =
      /\b(rahmat|tashakkur|thanks|thank you|ok|yaxshi|bo'pti|mayli|ha|no|bye|xayr)\b/i.test(userMessage);
    // REVIEWER FIX: boshqa MAVZU tuzatishlari university clarification'ga
    // hijack bo'lmasin — "Yo'q, boshqa shaharni aytgandim" (region tuzatishi)
    // yoki "Yo'q, boshqa yo'nalish" university so'rovi EMAS. Faqat universitеt
    // mavzusi (universitet/oliygoh/institut so'zlari yoki university entity)
    // birga kelsa clarify qilamiz.
    // KENGAYTMA (Fix #28/#30): "Yo'q, boshqa narsa so'radim" / "Yo'q, boshqasi"
    // — boshqa mavzu so'zi (shahar/yo'nalish/soha) yo'q bo'lsa va lastUniversity
    // BOR bo'lsa, user oldingi universitеtni rad etyapti deb qabul qilamiz →
    // qaysi mavzuni nazarda tutganini so'raymiz (generic "topa olmadim" o'rniga).
    const isOtherTopicWord =
      /\b(shahar|viloyat|yo'nalish|direction|soha|fan|kurs|mavzu)\b/i.test(userMessage);
    const isUniversityTopicCorrection =
      /\b(universitet|oliygoh|institut|akademiya)\w*\b/i.test(userMessage) ||
      !!intent.entities?.university ||
      (!!sessionContext?.lastUniversity &&
        !isOtherTopicWord &&
        /\b(boshqa|boshqasi|boshqasini|boshqacha|narsa|o'zga|yana bir)\b/i.test(userMessage));
    if (
      !repairName &&
      !isRejection &&
      !isConversationalRepair &&
      isUniversityTopicCorrection &&
      /\b(boshqa|boshqasi|boshqasini|o'zga|yana bir)\b/i.test(userMessage)
    ) {
      console.log(`[RepairClarification] "${userMessage}" — nom yo'q → qaysi universitеt so'raladi`);
      return {
        effectiveMessage,
        intent: { ...intent, intent: "unknown" as IntentResult["intent"] },
        augmented: true,
        additions: [],
        clarifyUniversity: true,
      };
    }
  }

  // RECOMMENDATION DIALOG DAVOMI (Fix 11):
  // Oxirgi assistant javobi recommendation intent bilan savol so'ragan bo'lsa
  // ("Qaysi shahar?", "Qanday yo'nalish?", "Davlatmi yoki xususiy?") va
  // foydalanuvchi qisqa javob bersa ("samarqand", "tibbiyot", "davlat"),
  // bu javob recommendation ga qaytarilishi kerak — unknown/faq ga tushib
  // "Kechirasiz, hozircha bu ma'lumotni topa olmadim" qaytarmasligi uchun.
  //
  // MUHIM: faqat OLDINGI javob recommendation bo'lganda ishlaydi — yangi
  // mavzu ochilganda ("toshkentdagi universitetlar" dan keyin "samarqand"
  // desa) bu qoida qo'llanilmaydi, chunki oldingi intent university_search.
  const lastAssistant = [...conversationHistory].reverse().find((m) => m.role === "assistant");
  // Oxirgi javob recommendation bo'lsa va unda DIALOG davom etayotgan bo'lsa
  // (savol so'ralgan YOKI natija topilmagan) — keyingi qisqa javob ham
  // recommendation ga qaytariladi. "topilmadi" ham shu yerga kiradi:
  // foydalanuvchi "tibbiyot" degan → topilmadi → "davlat" degan → davom etadi.
  //
  // MUHIM (reviewer): tekshiruv TILGA BOG'LIQ EMAS — o'zbekcha iboralarga
  // emas, tilga bog'liq bo'lmagan belgilarga tayanadi: savol belgisi (?),
  // raqamli ro'yxat (1️⃣/1.), yoki natija belgilari (topilmadi/tavsiyalar
  // — o'zbek, ru, en versiyalarida ham "?", raqamli ro'yxat, "ne" "not"
  // kabi umumiy so'zlar bor). Shu bilan rus/en tillaridagi dialog ham ishlaydi.
  const lastWasRecommendation =
    lastAssistant?.intent === "recommendation" &&
    /([?؟]|1️⃣|2️⃣|3️⃣|\b1\.\s|\b2\.\s|\b3\.\s|topilmadi|topa olmadim|variantni topaman|tavsiyalar|needsClarification|not found|no results)/i.test(lastAssistant.content || "");
  const hasAnswerEntity =
    !!intent.entities?.region ||
    !!intent.entities?.direction ||
    !!intent.entities?.institutionCategory ||
    !!intent.entities?.degree ||
    !!intent.entities?.language ||
    !!intent.entities?.educationType;

  // Suhbat uslubidagi so'zlar — dialog javobi EMAS ("rahmat", "salom"...)
  const isConversational = /\b(salom|assalomu|rahmat|tashakkur|thanks|thank you|ok|yaxshi|ha|yo'q|no|bye|xayr|hello|hi)\b/i.test(userMessage.trim());
  // Dialog davomida foydalanuvchi tanib olinmaydigan yo'nalish/soha aytgan
  // bo'lishi mumkin ("kosmonavtika") — buni ham recommendation ga yuboramiz,
  // u "topilmadi" deydi, generic "Kechirsiz, topa olmadim" qaytarmaydi.
  // MUHIM (Fix 16): faqat unknown/faq intent'li qisqa xabarlar javob deb
  // hisoblanadi. Aniq intent'li xabarlar ("grantlar bormi" → grant_search,
  // "yangiliklar" → news_list) YANGI MAVZU — ularni dialogga yutib bo'lmaydi!
  const isShortAnswer =
    wordCount <= 3 &&
    !isConversational &&
    (intent.intent === "unknown" || intent.intent === "faq");

  // MUHIM (Fix): aniq DATA intent'li so'rovlar (university_search,
  // direction_search...) dialog davomida bo'lsa ham YANGI MAVZU — ularni
  // recommendation dialogga yutib bo'lmaydi. "Toshkentdagi universitetlar"
  // (university_search + region entity) recommendation bo'lib qolmasligi kerak!
  //
  // MUHIM (reviewer fix): LEKIN dialog javoblari ham data intent'ga klassifi-
  // katsiyalanishi mumkin — "Qanday yo'nalish?" savoliga "tibbiyot" javobi
  // direction_search bo'ladi, "Davlatmi yoki xususiy?" savoliga "davlat"
  // javobi university_search bo'ladi (Step 2h). Ular dialogga QAYTARILISHI
  // kerak (Fix 14). Farq: to'liq yangi mavzu ("Toshkentdagi universitetlar")
  // ko'p so'zli va/yo universitet so'zini o'z ichiga oladi; bir so'zli dialog
  // javoblari esa QISQA va university so'zisiz. Shuning uchun guard faqat
  // (wordCount > 3 yoki hasUniWord) bo'lganda data intent'ni yangi mavzu deb
  // hisoblaydi — qisqa dialog javoblari yutilib qoladi.
  const isDataIntentQuery =
    [
      "university_search", "university_detail", "direction_search", "university_list",
      "direction_list", "grant_search", "grant_list", "news_search", "news_list",
      "tuition_search", "comparison", "admission", "transfer",
    ].includes(intent.intent) &&
    (wordCount > 3 || /\b(universitet|oliygoh|institut|akademiya)\w*\b/i.test(userMessage));

  // RECOMMENDATION MEMORY (BOSQICH 9) — DIALOG-SWALLOW'DAN OLDIN tekshiriladi!
  // Qisqa egalik follow-up ("yotoqxonasi", "kontrakti", "granti", "telefon
  // raqami") oxirgi tavsiya qilingan univga ishora qiladi. lastRecommendations
  // bor bo'lsa va foydalanuvchi aniq universitet nomi aytmagan bo'lsa —
  // ro'yxatdagi birinchi univ nomini effectiveMessage'ga qo'shamiz.
  // Misol: "Yotoqxonasi bormi?" → "Xalqaro Nordik universiteti yotoqxonasi bormi?"
  //
  // MUHIM (reviewer fix): bu blok DIALOG-SWALLOW'dan oldin kelishi kerak —
  // aks holda "yotoqxonasi bormi?" (qisqa, faq intent) recommendation
  // dialogiga yutib yuboriladi va memory hech qachon ishlamaydi.
  const memoryRecs = sessionContext?.lastRecommendations;
  // BOSQICH 11 — UNIVERSAL LAST-UNIVERSITY RESOLVER:
  // "uning narxlari qancha?", "kontrakti qancha?", "telefoni?" kabi follow-up
  // savollar OXIRGI KO'RILGAN UNIVERSITETGA bog'lanadi. Manba ustuvorligi
  // (user qoidasi): lastUniversity > lastRecommendations[0] > lastDirection.
  // lastUniversity ni search_university / search_direction / recommend /
  // get_university / search_tuition yozadi (tool-router rememberUniversity).
  // FIX (BOSQICH 10): "menga batafsil ma'lumot bera olasanmi?" kabi UMUMIY
  // detail so'rovlar ham oxirgi tavsiya qilingan universitеtga bog'lanadi.
  // Oldin faqat atribut so'zlari (yotoqxona/kontrakt/telefon...) tanib olinardi —
  // "batafsil ma'lumot" tushib qolib, STAGE 2 eski direction category
  // ("tibbiyot") ni prepend qilib, noto'g'ri universitеt (masalan
  // Qoraqalpog'iston tibbiyot instituti) qaytarardi.
  // USTUVORLIK (user qoidasi): lastUniversity > lastGrant > lastDirection >
  // lastRegion. Shuning uchun bu blok STAGE 1/2 dan OLDIN keladi.
  //
  // GUARD: foydalanuvchi o'zi yo'nalish/region/kategoriya aytgan bo'lsa
  // ("IT haqida batafsil ma'lumot", "Toshkentdagi yotoqxonasi") — bu yangi
  // mavzu, universitеt memory'siga bog'lanmaydi!
  const hasOwnFilter =
    hasDirectionMention(userMessage) ||
    hasRegionMention(userMessage) ||
    hasCategoryMention(userMessage);
  // Detail so'rovi (reviewer fix): "ko'proq ... ber" ("menga ko'proq variant
  // ber" = ko'proq variant so'rash, universitеt detail EMAS!) hijack bo'lmasligi
  // uchun "to'liq/ko'proq" faqat "ma'lumot/info" bilan birga kelsa ishlaydi.
  // "batafsil/batafsilroq" esa yolg'iz o'zi ham detail so'rovi ("batafsil ayt").
  const isDetailPhrase =
    /\b(batafsil|batafsilroq)\b/i.test(userMessage) ||
    (/\b(to'liq|ko'proq)\b/i.test(userMessage) && /\b(ma'lumot|info)\b/i.test(userMessage));
  // Attribute so'zlari — egalik/ko'plik shakllari bilan ("narxlari",
  // "kontraktlari", "grantlari", "telefonlari"): FIX (BOSQICH 11) — oldin
  // faqat "narx|narxi|lar" bor edi, "narxlari" tushib qolardi!
  const isAttributeWord =
    /\b(yotoqxona|kontrakt|grant|narh|narx|narhi|narxi|narhlari|narxlari|telefon|raqam|raqami|manzil|manzili|qabul|qabuli|ochiq|yopiq|stipendiya|stipendiyasi|sayt|sayti|link|linki|qayerda|qaerda|yotoqxonasi|kontrakti|kontraktlari|granti|grantlari|telefoni|telefonlari)(si|sini|i|ini|lar|lari|larini|larining|bormi|bormikan|qanday|qancha|qanchaga)?\b/i.test(userMessage);
  // BOSQICH 11 (PRONOUN RESOLVER): "uning", "o'sha", "shu", "u", "ana shu",
  // "o'shaniki" — oxirgi ko'rilgan universitеtga 100% ishora. "batafsil",
  // "kontrakti", "narxi", "telefoni", "sayti" kabi so'zlar ham university
  // kontekstini talab qiladi. Misol: "uning narxlari qancha?" →
  // "PDP University uning narxlari qancha?"
  //
  // MUHIM: "shu" so'zi xavfli — "shu universitet" degan iborada university
  // so'zi ham bor (hasUniWord guard bilan tekshiriladi pastda). Pronoun bilan
  // birga university so'zi kelsa, u yangi mavzu (bog'lanmaydi).
  // PRONOUN RESOLVER (reviewer fix): kuchli egalik olmoshlari ("uning",
  // "o'sha", "ana shu", "o'shaniki", "buning"...) yolg'iz o'zi university'ga
  // 100% ishora — xavfsiz. Kuchsiz ko'rsatish olmoshlari ("shu", "u") esa
  // XAVFLI: "shu yil o'qishga kirmoqchiman" (bu yil — yangi gap!) yoki
  // "u yerda o'qiyman" (u yerda = there) kabi so'rovlarda "shu/u" university'ga
  // emas, boshqa narsaga ishora qiladi. Shuning uchun kuchsiz olmoshlar FAQAT
  // attribute/detail so'zi bilan birga kelganda bog'lanadi ("shu kontrakti",
  // "u telefoni" kabi egalik-attribute birikmalari xavfsiz).
  const STRONG_PRONOUN = /\b(uning|o'sha|ana\s+shu|o'shaniki|buning|bularning|ularning)\b/i;
  const WEAK_PRONOUN = /\b(shu|u)\b/i;
  const hasStrongPronounRef = STRONG_PRONOUN.test(userMessage);
  const hasWeakPronounRef = WEAK_PRONOUN.test(userMessage);
  // Referensial kontekst: attribute so'zi ("kontrakti", "narxi"), detail
  // so'rovi ("batafsil") yoki "haqida" ("u haqida ayt" = u haqida → university).
  // "shu yil", "u yerda" kabi temporal/lokativ iboralar esa referensial EMAS.
  const isReferentialContext = isAttributeWord || isDetailPhrase || /\bhaqida\b/i.test(userMessage);
  const hasPronounRef =
    hasStrongPronounRef || (hasWeakPronounRef && isReferentialContext);
  const hasUniWordInMsg = /\b(universitet|oliygoh|institut|akademiya)\w*\b/i.test(userMessage);
  // UNIVERSAL MANBA: lastUniversity (eng ishonchli) yoki lastRecommendations[0]
  const lastUniSource =
    sessionContext?.lastUniversity ||
    (memoryRecs && memoryRecs.length > 0 ? { name: memoryRecs[0].name, slug: memoryRecs[0].slug } : undefined);

  // RECOMMENDATION NAVIGATION (BOSQICH 13): "Ikkinchisi-chi?" /
  // "Keyingisi-chi?" / "3-si-chi?" — oxirgi tavsiyalar ro'yxatidan
  // keyingi univni so'raydi. lastRecommendations[1], [2]... ga bog'lanadi
  // va lastUniversity ham yangilanadi (keyingi follow-up shu univga ketadi).
  // Misol: tavsiyalar [TATU, PDP, INHA] → "ikkinchisi-chi?" → PDP.
  const NAV_ORDINALS: Array<{ re: RegExp; index: number }> = [
    { re: /\b(birinchi|1-si|1-chisi)\b/i, index: 0 },
    { re: /\b(ikkinchisi|ikkinchisi-chi|2-si|2-chisi|keyingisi|keyingisi-chi|navbatdagisi|boshqasini|boshqasi)\b/i, index: 1 },
    { re: /\b(uchinchisi|uchinchisi-chi|3-si|3-chisi)\b/i, index: 2 },
    { re: /\b(to'rtinchisi|4-si|4-chisi)\b/i, index: 3 },
    { re: /\b(beshinchisi|5-si|5-chisi)\b/i, index: 4 },
  ];
  const navHit = NAV_ORDINALS.find((n) => n.re.test(userMessage));
  // MUHIM (long-test FIX): "Keyingisi-chi? Uning ham afzalliklari nima?"
  // kabi so'rovlar 6-8 so'z bo'lishi mumkin — nav hali ham bo'lishi kerak.
  // Qoida: index >= 1 ("ikkinchisi/keyingisi/uchinchisi" — aniq nav markerlari)
  // uchun wordCount 10 gacha ruxsat; "birinchi" (index 0) uchun esa faqat
  // qisqa (<= 4) YOKI "tavsiya qilingan/etilgan" markeri bo'lsa ruxsat.
  // REVIEWER FIX: "Birinchi navbatda ..." ("first of all") kabi keng qo'llaniladigan
  // iboralar wordCount <= 10 da nav bo'lib hijack qilmasligi kerak — shuning
  // uchun index 0 da kengaytirilgan chegarani marker bilan bog'ladik.
  const hasRecommendationRef = /(tavsiya qilingan|tavsiya etilgan)/i.test(userMessage);
  const navWordOk = navHit
    ? navHit.index >= 1 ? wordCount <= 10 : wordCount <= 4 || hasRecommendationRef
    : false;
  const isNavQuery =
    navHit &&
    memoryRecs &&
    memoryRecs.length > navHit.index &&
    !intent.entities?.university &&
    !intent.entities?.direction &&
    navWordOk &&
    !hasOwnFilter &&
    // "Birinchi universitеt qaysi?" — nav emas, savol. Ordinal + so'roq
    // belgisi va 4 so'zdan kam bo'lsa nav deb hisoblamaymiz (noaniq).
    !(navHit.index === 0 && wordCount <= 4 && /\?$/.test(userMessage.trim()));
  if (isNavQuery && navHit) {
    const target = memoryRecs[navHit.index];
    if (target?.name) {
      if (sessionContext) {
        sessionContext.lastUniversity = {
          id: target.id,
          name: target.name,
          slug: target.slug,
        };
      }
      effectiveMessage = `${target.name} haqida batafsil ma'lumot ber`;
      intent = intentClassifier.classify(effectiveMessage);
      intent = { ...intent, entities: sanitizeResolvedUniversityEntities(intent.entities) };
      const navEntities = { ...intent.entities };
      if (!navEntities.university || navEntities.university.length < target.name.length) {
        navEntities.university = target.name;
      }
      intent = { ...intent, entities: navEntities };
      console.log(`[Nav] "${userMessage}" → "${effectiveMessage}" → ${intent.intent}`);
      return { effectiveMessage, intent, augmented: true, additions: [target.name] };
    }
  }
  // GUARD: yo'nalish/soha konteksti university'ga bog'lanmaydi — "shu
  // yo'nalishda qanday grantlar bor" (follow-up direction mavzusiga, university
  // emas) yoki "soha bo'yicha nima tavsiya qilasiz" kabi so'rovlar.
  // REVIEWER FIX: "yo'nalishi/lari" (egalik shakli) bu yerda EMAS — ular
  // university attribute so'rovi ("uning yo'nalishlari qancha") va Context
  // Resolver attributeWordMatch orqali ishlaydi. Faqat BARE (yo'nalishda,
  // soha bo'yicha) shakllar yangi direction mavzusini bildiradi.
  const hasDirectionTopicWord = /\b(yo'nalish(?:da|dagi|larga|larida)?|soha(?:sida|sidagi|si)?|kasb|mutaxassislik)\b/i.test(userMessage);
  // RECOMMENDATION PREFERENCE STATEMENT (Fix #85-88): "Yotoqxona ham kerak",
  // "Grant bo'lsa yaxshi", "Xususiylardan qara", "20 milliondan oshmasin",
  // "Eng yaxshisini ayt" — bu UNIVERSITET ATTRIBUTE SAVOLI EMAS ("Yotoqxonasi
  // bormi?"), balki YANGI PREFERENCE (re-ranking uchun). Recommendation dialog
  // faol bo'lsa (lastWasRecommendation), bunday xabarlar universitеt memory'siga
  // bog'lanib "yo'nalishlar" yoki "granti" javobiga hijack bo'lmasligi kerak —
  // ular recommendation dialogga qaytib, yangi preference bilan qayta
  // saralanadi. ATRIBUT SAVOLLARI ("bormi?", "qancha?") bu yerga kirmaydi.
  const isPreferenceStatement =
    // Aniq istak iboralari: "ham kerak", "bo'lsa yaxshi", "bo'lsin"...
    /\b(ham\s+kerak|bo'lsa\s+(?:yaxshi|zo'r)|bo'lsin|bo'lishi\s+kerak|kerak\s+bo'lsa|o'?shmasin|oshmasin)\b/i.test(userMessage) ||
    // MUHIM (Fix #42/#60): "Yotoqxona kerak", "Grant kerak", "Xususiy kerak"
    // — "kerak" yolg'iz ham preference signali ("ham kerak" talab qilinmasin).
    // Xavfsizlik: faqat ATTRIBUTE/ISTAK so'zlaridan keyin kelgan "kerak"
    // preference deb hisoblanadi ("universitet kerak" ham — yangi so'rov emas,
    // recommendation istagi).
    /\b(?:yotoqxona|grant|stipendiya|xususiy|davlat|xalqaro|nodavlat|universitet|variant)\w*\s+(?:ham\s+)?kerak\b/i.test(userMessage) ||
    // "grant muhimroq" — preference ustuvorligi (yangi re-ranking signali)
    /\b(?:grant|yotoqxona|xususiy|davlat|narx|budget)\w*\s+muhim(?:roq|i)?\b/i.test(userMessage) ||
    // Kategoriya + istak: "Xususiylardan qara", "Davlatdan kerak", "Xalqaro bo'lsin"
    /\b(xususiy|xususiylar|davlat|xalqaro|nodavlat)\w*\s+(qara|qaraylik|qarang|ko'rsat|kerak|bo'lsin|bo'lsa)\b/i.test(userMessage) ||
    // Byudjet cheklovi: "20 milliondan oshmasin", "15 mln gacha bo'lsin"
    hasBudgetMention(userMessage) ||
    // Eng yaxshi tanlov: "Eng yaxshisini ayt"
    /\beng\s+yaxshisi\b/i.test(userMessage);
  const isMemoryFollowUp =
    !!lastUniSource?.name &&
    !intent.entities?.university &&
    !intent.entities?.direction &&
    !hasOwnFilter &&
    !hasDirectionTopicWord &&
    // GUARD (Fix #85-88): recommendation dialog faol bo'lsa, preference
    // xabarlari universitеtga bog'lanmaydi — dialogga qaytadi (re-ranking).
    !(lastWasRecommendation && isPreferenceStatement) &&
    // GUARD: pronoun + university so'zi birga kelsa yangi mavzu ("shu
    // universitetda nima bor" → bog'lanmaydi). Pronoun bilan university so'zi
    // kelmasa — 100% university kontekst ("uning narxlari qancha").
    !(hasPronounRef && hasUniWordInMsg) &&
    wordCount <= 8 &&
    (isAttributeWord || isDetailPhrase || hasPronounRef);
  if (isMemoryFollowUp) {
    const uniName = lastUniSource.name;
    if (uniName) {
      effectiveMessage = `${uniName} ${effectiveMessage}`;
      intent = intentClassifier.classify(effectiveMessage);
      // Fix 19: memory'dan qo'shilgan university nomi qayta klassifikatsiyada
      // spurious entity'lar chiqarishi mumkin ("Xalqaro Nordik universiteti"
      // → institutionCategory=5). University aniq bo'lsa ular keraksiz.
      intent = { ...intent, entities: sanitizeResolvedUniversityEntities(intent.entities) };
      // BOSQICH 11: classifier qisqa nom chiqarsa ham ("PDP University" →
      // "PDP"), TO'LIQ eslab qolingan nomni majburiy o'rnatamiz — search_tuition/
      // search_university aniq univni topsin (qisqa "PDP" boshqa univlarga ham
      // substring bo'lib tushishi mumkin).
      const entities = { ...intent.entities };
      if (!entities.university || entities.university.length < uniName.length) {
        entities.university = uniName;
      }
      intent = { ...intent, entities };
      console.log(`[Memory] Follow-up "${userMessage}" → "${effectiveMessage}" → ${intent.intent}`);
      return { effectiveMessage, intent, augmented: true, additions: [uniName] };
    }
  }

  // CONTEXT RESOLVER (Fix 19) — qisqa university-attribut savollari.
  // "TATU haqida ayt → Rektori kim?" / "KIUT → Telefon raqami?" /
  // "TTA → Qabul ochilganmi?" kabi follow-up'larda university entity bo'lmasa,
  // oxirgi muhokama qilingan universitet nomi qo'shiladi. Shartlar:
  //   - message QISQA (<=6 so'z) va attribut so'zidan iborat bo'lishi kerak
  //   - message da university entity bo'lmasligi kerak
  //   - message o'zida university so'zi/region bo'lmasligi kerak (yangi mavzu!)
  //   - oxirgi muhokama qilingan university TOPILGAN bo'lishi kerak
  // FIX (BOSQICH 10): "batafsil ma'lumot" kabi UMUMIY detail so'rovlari ham
  // shu yerga kiritildi — lastRecommendations bo'lmasa ham (currentTopicName/
  // history orqali topilgan) oxirgi muhokama qilingan universitеtga bog'lanadi.
  // "EMU universiteti → menga batafsil ma'lumot bera olasanmi" zanjiri shu
  // yo'l bilan ishlaydi (findLastMentionedUniversity pastda chaqiriladi).
  // REVIEWER FIX: detail branch ("batafsil ma'lumot") direction entity bo'lsa
  // bloklanadi ("IT haqida batafsil ma'lumot" → IT o'z mavzusi, universitеtga
  // bog'lanmaydi). Attribute branch esa GUARDsiz — "TATU → IT yo'nalishlari
  // bormi?" zanjiri yo'nalish so'zi borligida ham universitеtga bog'lanishi
  // kerak ("yo'nalishlari" attribute word hisoblanadi).
  // BOSQICH 11: Context Resolver ham pronoun va plural shakllarni tanisin
  // ("uning narxlari qancha?" lastUniversity bo'lmasa ham history/topic dan
  // topish uchun). Narx/kontrakt/grant/telefon plural-egalik shakllari.
  const attributeWordMatch =
    /\b(telefon|telefoni|telefonlari|raqam|raqami|nomer|manzil|manzili|qayerda|qaerda|rektor|rektori|prorektor|rahbari|grant|granti|grantlari|stipendiya|stipendiyasi|qabul|qabuli|kirish|ochilgan|ochiq|yopiq|yotoqxona|yotoqxonasi|kontrakt|kontrakti|kontraktlari|narx|narxi|narhlari|narxlari|to'lov|to'lovi|sayt|sayti|link|linki|hamkorlik|tashkil etilgan|asos solingan|tarixi|fakultet|fakultetlari|dasturlari|yo'nalishlari|budjeti|byudjeti)\b/i.test(userMessage);
  const detailMatch =
    isDetailPhrase && !intent.entities?.direction;
  // Pronoun ham Context Resolver'ni ishga tushiradi — "uning narxlari",
  // "u haqida ayt" (lastUniversity bo'lmasa history/topic dan qidiriladi).
  // REVIEWER FIX: xuddi isMemoryFollowUp dagi kabi kuchsiz olmoshlar ("shu",
  // "u") faqat attribute/detail so'zi bilan birga kelganda ishlaydi.
  const hasPronounRef2 =
    hasStrongPronounRef || (hasWeakPronounRef && (attributeWordMatch || detailMatch || /\bhaqida\b/i.test(userMessage)));
  const isUniAttributeQuery =
    wordCount <= 8 &&
    !intent.entities?.university &&
    !/\b(universitet|oliygoh|institut|akademiya)\w*\b/i.test(userMessage) &&
    !hasRegionMention(userMessage) &&
    !isConversational &&
    (attributeWordMatch || detailMatch || hasPronounRef2);
  if (isUniAttributeQuery) {
    const uniName = findLastMentionedUniversity(sessionContext, conversationHistory);
    if (uniName && !effectiveMessage.toLowerCase().includes(uniName.toLowerCase())) {
      effectiveMessage = `${uniName} ${effectiveMessage}`;
      intent = intentClassifier.classify(effectiveMessage);
      // Fix 19: university nomidagi so'zlar ("kimyo"→muhandislik,
      // "xalqaro"→cat 5) spurious entity bo'lib qolmasin — ular university'ni
      // noto'g'ri filtrlab yuborishi mumkin (masalan KIUT xususiy=4 bo'la
      // turib institutionCategory=5 filteri uni exclude qiladi).
      intent = { ...intent, entities: sanitizeResolvedUniversityEntities(intent.entities) };
      console.log(`[ContextResolver] "${userMessage}" → "${effectiveMessage}" → ${intent.intent}`);
      return { effectiveMessage, intent, augmented: true, additions: [uniName] };
    }
  }

  if (lastWasRecommendation && wordCount <= 6 && (hasAnswerEntity || isShortAnswer || isPreferenceStatement) && !isDataIntentQuery) {
    // Region entity bo'lsa — sessionContext'ga ham yozamiz (keyingi javobda ishlatiladi)
    if (intent.entities?.region && sessionContext) {
      sessionContext.currentRegion = intent.entities.region as string;
    }
    if (intent.entities?.institutionCategory && sessionContext) {
      sessionContext.currentInstitutionCategory = intent.entities.institutionCategory as string;
    }
    // Fix: "davlat yoki xalqaro" kabi bir nechta kategoriya tanlangan bo'lsa,
    // barchasi session'da saqlanadi — follow-up'da ikkinchisi yo'qolib qolmaydi.
    if (Array.isArray(intent.entities?.institutionCategories) && sessionContext) {
      sessionContext.currentInstitutionCategories = intent.entities.institutionCategories as string[];
    }
    console.log(`[FollowUp] Recommendation dialog javobi: "${userMessage}" → recommendation (entities=${JSON.stringify(intent.entities)})`);
    return {
      effectiveMessage: userMessage,
      intent: { ...intent, intent: "recommendation" as IntentResult["intent"], confidence: 0.85 },
      augmented: true,
      additions: [],
    };
  }

  // YANGI MAVZU DETEKSIYASI (Bug 2 fix):
  // "men doktor bo'lmoqchiman", "tibbiyotga qiziqaman" kabi so'rovlar
  // o'z-o'zidan to'liq — foydalanuvchi YANGI mavzu ochadi (kasb tanlash /
  // qiziqish bildirish). Bunday hollarda eski session konteksti
  // ("Davlat universitetlar", "Toshkent shahri") QO'SHILMASLIGI kerak,
  // aks holda intent buziladi (direction_search → university_search).
  // Farqi: "ITlari", "Davlatlari" kabi qisqa egalik shakllari follow-up,
  // "...bo'lmoqchiman/qiziqaman" esa yangi mavzu.
  //
  // MUHIM (prod fix): "Tibbiyot universitetlari", "Toshkentdagi davlat
  // universitetlari" kabi to'liq so'rovlar ham YANGI MAVZU — eski direction/
  // kategoriya konteksti qo'shilmasligi kerak. Qoida: so'rovda "universitet/"
  // yo'nalish/oliygoh" so'zi bo'lsa yoki region+universitet birga kelsa,
  // foydalanuvchi o'zi to'liq so'rayapti.
  const hasOwnDirection = !!intent.entities?.direction || !!detectDirectionCategory(userMessage);
  const hasUniWord = /\b(universitet|oliygoh|institut|akademiya)(lar|lari|larida|laridan|lariga|larda|dagi|larini|larining)?\b/i.test(userMessage);
  const hasRegionAndUni = hasRegionMention(userMessage) && hasUniWord;
  const isSelfContainedTopic =
    (hasOwnDirection && (hasInterestPhrase(userMessage) || hasUniWord)) ||
    hasRegionAndUni;

  if (
    wordCount >= 8 ||
    NON_ENHANCE_INTENTS.includes(intent.intent) ||
    isTopicSwitch ||
    isSelfContainedTopic
  ) {
    return { effectiveMessage, intent, augmented: false, additions: [] };
  }

  // STAGE 1: Mavzu nomi (currentTopicName / oxirgi assistant sarlavhasi)
  // "Toshkent shahri", "Amity Universiteti" kabi — keyingi follow-up'ga asos.
  // MUHIM (Bug 1 fix): STAGE 1 va STAGE 2 alohida array'lar ishlatadi.
  // Avval `additions` bitta array edi — STAGE 2 `additions.join(" ")` bilan
  // STAGE 1 qo'shgan mavzuni YANA prepend qilib, "Davlat universitetlar
  // Davlat universitetlar ..." kabi ikki marta qo'shilishga olib kelardi.
  const stage1Additions: string[] = [];
  let topicApplied = false;
  const topicName = extractTopicName(sessionContext, conversationHistory);
  if (topicName && topicName.length > 3) {
    const msgLower = effectiveMessage.toLowerCase();
    const topicLower = topicName.toLowerCase();
    const hasUniName = msgLower.includes(topicLower) ||
      topicLower.split(" ").some((part: string) => part.length > 4 && msgLower.includes(part));

    // MUHIM (prod fix): agar foydalanuvchi yangi xabarida ANIQ REGION aytgan
    // bo'lsa ("Samarqanddagi davlat universitetlari") va eski topic ham region
    // bo'lsa ("Toshkent shahri") — eski topic QO'SHILMAYDI, aks holda yangi
    // region buzilib, "Toshkent shahri Samarqanddagi..." bo'lib qolardi.
    // Faqat region EMAS (universitet nomi/yo'nalish) topic bo'lsa qo'shamiz.
    const msgHasRegion = hasRegionMention(userMessage);
    const topicIsRegion = hasRegionMention(topicName);
    const regionConflict = topicIsRegion && msgHasRegion;

    // REVIEWER FIX (BOSQICH 10): topic UNIVERSITET nomi va xabar o'z YO'NALISHI
    // bor ("IT haqida batafsil ma'lumot") — topic QO'SHILMAYDI! Aks holda
    // "EMU universiteti IT haqida batafsil ma'lumot" bo'lib, yo'nalish so'rovi
    // universitеtga yutilib ketardi. "TATU → IT yo'nalishlari bormi?" zanjiri
    // esa isUniAttributeQuery (attribute word) orqali ishlaydi — STAGE 1 ga
    // bog'liq emas, shuning uchun bu guard uni buzmaydi.
    const msgHasOwnDirection = !!intent.entities?.direction || hasDirectionMention(userMessage);
    const topicIsUniversityName = /(universitet|university|institut|institute|akademiya|academy|oliygoh)/i.test(topicName);
    const directionTopicConflict = msgHasOwnDirection && topicIsUniversityName;

    if (!hasUniName && !regionConflict && !directionTopicConflict) {
      effectiveMessage = `${topicName} ${effectiveMessage}`;
      stage1Additions.push(topicName);
      intent = intentClassifier.classify(effectiveMessage);
      topicApplied = true;
      console.log(`[FollowUp] Topic: "${userMessage}" -> "${effectiveMessage}" -> ${intent.intent}`);
    }
  }

  // STAGE 2: Session context entity'lari
  // MUHIM: mavzu qo'llangan bo'lsa ham, direction/category/degree kabi kontekst
  // qo'shiladi — "Toshkent shahri → ITlari → Davlatlari" zanjiri shunday ishlaydi
  // (har qadamda kontekst boyib boradi).
  //
  // QO'RQA: agar qayta klassifikatsiyada aniq UNIVERSITET nomi topilgan bo'lsa
  // ("Amity Universiteti qanday grantlar bor"), session context QO'SHILMAYDI —
  // aks holda "Toshkent Amity Universiteti ..." bo'lib qidiruv buziladi.
  const hasUniversityEntity = !!intent.entities?.university;
  const stage2Additions: string[] = [];
  if (sessionContext && !hasUniversityEntity) {
    if (sessionContext.currentRegion && !hasRegionMention(effectiveMessage)) {
      const regionName = lookupManager.getRegionName(parseInt(sessionContext.currentRegion), language);
      if (regionName && !/^Region #/.test(regionName)) stage2Additions.push(regionName);
    }
    if (sessionContext.currentInstitutionCategory && !hasCategoryMention(effectiveMessage)) {
      const label = getInstitutionCategoryLabel(sessionContext.currentInstitutionCategory);
      if (label) stage2Additions.push(label);
    }
    if (sessionContext.currentDirectionCategory && !hasDirectionMention(effectiveMessage)) {
      stage2Additions.push(sessionContext.currentDirectionCategory);
    }
    if (sessionContext.currentDegree && !hasDegreeMention(effectiveMessage)) {
      const label = getDegreeLabel(sessionContext.currentDegree, language);
      if (label) stage2Additions.push(label);
    }
    if (sessionContext.currentLanguage && !hasLanguageMention(effectiveMessage)) {
      const label = getLanguageLabel(sessionContext.currentLanguage, language);
      if (label) stage2Additions.push(label);
    }
    if (
      (sessionContext.currentTuitionMax !== undefined || sessionContext.currentTuitionMin !== undefined) &&
      !hasBudgetMention(effectiveMessage)
    ) {
      const budgetText = formatBudget(sessionContext);
      if (budgetText) stage2Additions.push(budgetText);
    }

    if (stage2Additions.length > 0) {
      effectiveMessage = `${stage2Additions.join(" ")} ${effectiveMessage}`;
      intent = intentClassifier.classify(effectiveMessage);
      console.log(`[FollowUp] Session context: "${userMessage}" -> "${effectiveMessage}" -> ${intent.intent}`);
    }
  }

  const additions = [...stage1Additions, ...stage2Additions];

  return {
    effectiveMessage,
    intent,
    augmented: additions.length > 0,
    additions,
  };
}
