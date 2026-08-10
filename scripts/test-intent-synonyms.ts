/**
 * TEST: Intent classifier + direction synonyms + interest phrases.
 * Verifies that no matter how the user phrases a direction query,
 * the intent is correctly classified as direction_search (not faq).
 */
process.env.GROQ_API_KEY = "";
process.env.GEMINI_API_KEY = "";
process.env.OPENAI_API_KEY = "";
process.env.JINA_API_KEY = "";

import { normalizeUserText } from "../src/ai-agent/text-normalizer";
import { intentClassifier } from "../src/ai-agent/intent-classifier";
import { detectDirectionCategory, hasInterestPhrase, hasDirectionMention } from "../src/ai-agent/direction-synonyms";
import { toolRouter } from "../src/ai-agent/tool-router";
import { augmentFollowUp } from "../src/ai-agent/follow-up-context";
import { buildSnapshotHistory } from "../src/ai-agent/compact-history";
import { detectRequestField, isBareFieldRequest } from "../src/ai-agent/request-field";
import {
  ALL_INTENTS,
  getIntentDataFlag,
  getIntentHandler,
  getIntentTool,
  getSelfCompleteIntents,
  validateIntentConfig,
} from "../src/ai-agent/intent-config";
import { parseEntitiesJSON } from "../src/ai-agent/llm-entity-extractor";
import { responseBuilder } from "../src/ai-agent/formatter";

const cases: Array<{ msg: string; expectIntent?: string; expectDir?: string; expectEntities?: Record<string, any> }> = [
  // --- tibbiyot synonyms + interest phrases ---
  { msg: "tibbiyotga qiziqaman", expectIntent: "direction_search", expectDir: "tibbiyot" },
  { msg: "men tibbiyotga aloqador", expectIntent: "direction_search", expectDir: "tibbiyot" },
  { msg: "meditsina bo'yicha o'qimoqchiman", expectIntent: "direction_search", expectDir: "tibbiyot" },
  { msg: "vrach bo'lmoqchiman", expectIntent: "direction_search", expectDir: "tibbiyot" },
  { msg: "shifokor bo'lishni xohlayman", expectIntent: "direction_search", expectDir: "tibbiyot" },
  { msg: "farmatsiyaga qiziqaman", expectIntent: "direction_search", expectDir: "tibbiyot" },
  { msg: "tibbiyot yo'nalishlari", expectIntent: "direction_search", expectDir: "tibbiyot" },
  { msg: "davolash ishi bilan shug'ullanmoqchiman", expectIntent: "direction_search", expectDir: "tibbiyot" },
  // --- IT synonyms ---
  { msg: "IT ga qiziqaman", expectIntent: "direction_search", expectDir: "it" },
  { msg: "dasturchi bo'lmoqchiman", expectIntent: "direction_search", expectDir: "it" },
  // TYPO TOLERANCE: "daturchi" (s tushib qolgan) va "bolmoqchiman" (apostrof yo'q)
  // → hali ham direction_search (IT) bo'lishi kerak, faq EMAS!
  { msg: "daturchi bolmoqchiman", expectIntent: "direction_search", expectDir: "it" },
  { msg: "dasturchi bolmoqchiman", expectIntent: "direction_search", expectDir: "it" },
  { msg: "kompyuterni yaxshi ko'raman", expectIntent: "direction_search", expectDir: "it" },
  { msg: "programmist bo'lishni istayman", expectIntent: "direction_search", expectDir: "it" },
  // --- iqtisod ---
  { msg: "iqtisodga qiziqaman", expectIntent: "direction_search", expectDir: "iqtisod" },
  { msg: "buxgalter bo'lmoqchiman", expectIntent: "direction_search", expectDir: "iqtisod" },
  { msg: "bank sohasida ishlamoqchiman", expectIntent: "direction_search", expectDir: "iqtisod" },
  { msg: "moliya yaxshi ko'raman", expectIntent: "direction_search", expectDir: "iqtisod" },
  // --- huquq ---
  { msg: "huquqshunos bo'lmoqchiman", expectIntent: "direction_search", expectDir: "huquq" },
  { msg: "advokat bo'lishni xohlayman", expectIntent: "direction_search", expectDir: "huquq" },
  // --- pedagogika ---
  { msg: "o'qituvchi bo'lmoqchiman", expectIntent: "direction_search", expectDir: "pedagogika" },
  { msg: "pedagogikaga qiziqaman", expectIntent: "direction_search", expectDir: "pedagogika" },
  { msg: "maktabgacha ta'limga qiziqaman", expectIntent: "direction_search", expectDir: "pedagogika" },
  // --- muhandislik ---
  { msg: "qurilish muhandisi bo'lmoqchiman", expectIntent: "direction_search", expectDir: "muhandislik" },
  { msg: "arxitekturaga qiziqaman", expectIntent: "direction_search", expectDir: "muhandislik" },
  { msg: "robototexnikaga qiziqaman", expectIntent: "direction_search", expectDir: "muhandislik" },
  // --- filologiya ---
  { msg: "tarjimon bo'lmoqchiman", expectIntent: "direction_search", expectDir: "filologiya" },
  { msg: "chet tilini yaxshi ko'raman", expectIntent: "direction_search", expectDir: "filologiya" },
  // --- sanat ---
  { msg: "dizaynga qiziqaman", expectIntent: "direction_search", expectDir: "sanat" },
  { msg: "rassom bo'lmoqchiman", expectIntent: "direction_search", expectDir: "sanat" },
  { msg: "musiqaga qiziqaman", expectIntent: "direction_search", expectDir: "sanat" },
  // --- sport ---
  { msg: "sportchi bo'lmoqchiman", expectIntent: "direction_search", expectDir: "sport" },
  { msg: "futbolchiga qiziqaman", expectIntent: "direction_search", expectDir: "sport" },
  // --- turizm ---
  { msg: "turizmga qiziqaman", expectIntent: "direction_search", expectDir: "turizm" },
  { msg: "mehmonxona sohasida ishlamoqchiman", expectIntent: "direction_search", expectDir: "turizm" },
  // --- qishloq ---
  { msg: "agronom bo'lmoqchiman", expectIntent: "direction_search", expectDir: "qishloq" },
  { msg: "veterinariyaga qiziqaman", expectIntent: "direction_search", expectDir: "qishloq" },
  // --- KATALOG intentlari (search EMAS) ---
  { msg: "qanday yo'nalishlar mavjud", expectIntent: "direction_list" },
  { msg: "qanday yo'nalishlar bor", expectIntent: "direction_list" },
  { msg: "yo'nalishlar ro'yxati", expectIntent: "direction_list" },
  { msg: "qanday universitetlar bor", expectIntent: "university_list" },
  { msg: "universitetlar ro'yxati", expectIntent: "university_list" },
  { msg: "qanday grantlar bor", expectIntent: "grant_list" },
  { msg: "qanday yangiliklar bor", expectIntent: "news_list" },
  // --- direction_list → direction_search (aniq kategoriya/universitet bo'lsa) ---
  { msg: "qanday tibbiyot yo'nalishlari mavjud", expectIntent: "direction_search", expectDir: "tibbiyot" },
  { msg: "Samarqand davlat universitetida qanday yo'nalishlar bor", expectIntent: "direction_search" },
  // --- tuition_search ---
  { msg: "eng arzon universitetlar", expectIntent: "tuition_search" },
  { msg: "kontrakt narxlari qancha", expectIntent: "tuition_search" },
  { msg: "universitetlarning narxi qancha", expectIntent: "tuition_search" },
  // BARE PRICE PHRASES — qo'shimcha so'zsiz ham tuition_search bo'lishi kerak
  { msg: "kontrakt narxlari", expectIntent: "tuition_search" },
  { msg: "kontrakt narhlari", expectIntent: "tuition_search" },
  { msg: "narxlar", expectIntent: "tuition_search" },
  { msg: "to'lovlar", expectIntent: "tuition_search" },
  // TYPO TOLERANCE — "kantrakt narxlaari" → "kontrakt narxlari" bo'lib tuition_search ga tushishi kerak
  { msg: "kantrakt narxlaari", expectIntent: "tuition_search" },
  { msg: "kantrakt narxlari", expectIntent: "tuition_search" },
  { msg: "kontrakt narxlaari", expectIntent: "tuition_search" },
  { msg: "narxlaari", expectIntent: "tuition_search" },
  // --- non-direction cases (must NOT become direction) ---
  { msg: "salom", expectIntent: "greeting" },
  { msg: "grantlar bormi", expectIntent: "grant_search" },
  { msg: "so'nggi yangiliklar", expectIntent: "news_search" },
  { msg: "Toshkentdagi universitetlar", expectIntent: "university_search" },
  { msg: "qaysi universitet yaxshiroq", expectIntent: "comparison" },
  // follow-up egalik shakli — direction_list emas, direction_search bo'lishi kerak
  { msg: "yo'nalishlari", expectIntent: "direction_search" },
  // --- E2E murakkab filter so'rovlari — university_search bo'lishi kerak (direction_search EMAS!) ---
  // "Toshkendagi xususiy tibbiyot universitetlari, 20 mln gacha" — region+kategoriya+yo'nalish+byudjet
  // MUHIM (prod fix): kategoriya sinonimi + UMUMIY universitet so'zi (aniq nom
  // emas) → direction_search (o'sha yo'nalish bor universitetlar + xususiy +
  // byudjet filter). Avval university_search edi — direction entity e'tiborsiz
  // qolar, "tibbiyot" filteri ishlamasdi.
  { msg: "Toshkentdagi xususiy tibbiyot universitetlari, 20 mln gacha", expectIntent: "direction_search", expectDir: "tibbiyot" },
  // "ingliz tilidagi xususiy bakalavr universitetlar" — degree/ET university FILTRI (Step 2a zaif signal + university ref)
  { msg: "Toshkent shahrida ingliz tilidagi xususiy bakalavr universitetlar", expectIntent: "university_search" },
  // vergul bilan: "kunduzgi, rus tilidagi davlat universitetlar"
  { msg: "Buxorodagi kunduzgi, rus tilidagi davlat universitetlar", expectIntent: "university_search" },
  // Kuchli signal hali ham o'tkazadi: "universitetida qanday yo'nalishlar bor" → direction_search
  { msg: "Samarqand davlat universitetida qanday yo'nalishlar bor", expectIntent: "direction_search" },
  // --- STRESS TEST FIXLARI (1-6) ---
  // Fix 4: Stomatologiya — tibbiyot sinonimi sifatida direction_search
  { msg: "Stomatologiya qayerlarda bor", expectIntent: "direction_search", expectDir: "tibbiyot" },
  { msg: "stomatologiya yo'nalishi bormi", expectIntent: "direction_search", expectDir: "tibbiyot" },
  // Fix 4: Matematika — muhandislik sinonimi sifatida direction_search
  { msg: "Matematikam yaxshi", expectIntent: "recommendation" },
  { msg: "matematika fakulteti qayerda", expectIntent: "direction_search", expectDir: "muhandislik" },
  // Fix 3: 'yoki' bilan solishtirish → comparison
  { msg: "Amity yoki Westminster qaysi yaxshi", expectIntent: "comparison" },
  { msg: "TATU va INHA ni solishtir", expectIntent: "comparison" },
  { msg: "Davlatmi yoki xususiymi", expectIntent: "comparison" },
  // Fix 3 regressiya: "va" boshqa so'z bilan kelsa comparison EMAS (university_search bo'ladi)
  { msg: "TATU va boshqa universitetlar haqida", expectIntent: "university_search" },
  { msg: "Amity va boshqa xalqaro universitetlar", expectIntent: "university_search" },
  { msg: "Westminster va TATU haqida ma'lumot", expectIntent: "university_search" },
  { msg: "TATU va INHA haqida ma'lumot", expectIntent: "university_search" },
  // Fix 5: Sun'iy intellekt apostrof variantlari → direction_search (IT)
  { msg: "Sun'iy intellekt yo'nalishi bormi", expectIntent: "direction_search", expectDir: "it" },
  { msg: "suniy intellektga qiziqaman", expectIntent: "direction_search", expectDir: "it" },
  // Fix 6: Suhbat uslubidagi savollar → recommendation / tuition_search
  { msg: "men nima o'qisam ekan", expectIntent: "recommendation" },
  { msg: "IELTS 6.5 bor", expectIntent: "recommendation" },
  { msg: "pulim kam", expectIntent: "tuition_search" },
  { msg: "xorijga ketmoqchiman", expectIntent: "recommendation" },
  // Fix 2: typo tolerantlik kengaytmasi
  { msg: "tibiyot yo'nalishi", expectIntent: "direction_search", expectDir: "tibbiyot" },
  { msg: "kompyutr yaxshi ko'raman", expectIntent: "direction_search", expectDir: "it" },
  { msg: "dasturlaw bolmoqchiman", expectIntent: "direction_search", expectDir: "it" },
  { msg: "Toshkentda universtitlar", expectIntent: "university_search" },
  { msg: "grantla bormi", expectIntent: "grant_search" },
  // grant_list regressiya: "grantla" normalizatsiyasi "grantlar" ni buzmasligi kerak!
  { msg: "qanday grantlar bor", expectIntent: "grant_list" },
  // Fix 1: follow-up egalik shakllari (Davlatlari → davlat filtri)
  { msg: "Davlatlari", expectIntent: "university_search" },
  // Stress test qoldiqlari: "qayerga topshirsam" / "mosi qaysi" → recommendation
  { msg: "Qayerga topshirsam yaxshi", expectIntent: "recommendation" },
  { msg: "Menga mosi qaysi", expectIntent: "recommendation" },
  { msg: "Qaysi biri yaxshi", expectIntent: "comparison" },
  // Fix 11: recommendation dialog javoblari — yakka shahar nomi ham
  // region entity bilan qaytishi kerak (unknown ga tushsa ham)
  { msg: "samarqand", expectEntities: { region: "8" } },
  { msg: "toshkent", expectEntities: { region: "14" } },
  { msg: "buxoro", expectEntities: { region: "3" } },
  // --- BOSQICH 8: Intent classification fix — maslahat/ruhiy so'rovlar general_chat ---
  // "universitet" so'zining o'zi recommendation triggeri EMAS!
  // Uzun gap oxiridagi "universitet" so'zi university entity bo'lib qolmasligi kerak.
  { msg: "Salom. Men bu yil imtihondan yiqildim, lekin universitetda o'qishni orzu qilaman. Qanday maslahat berasan?", expectIntent: "general_chat" },
  { msg: "Men bu yil imtihondan yiqildim, lekin universitetda o'qishni orzu qilaman", expectIntent: "general_chat" },
  { msg: "Qanday maslahat berasan?", expectIntent: "general_chat" },
  { msg: "Men universitetga kira olmadim", expectIntent: "general_chat" },
  { msg: "Salom. Men bu yil imtihondan yiqildim. Nima qilay?", expectIntent: "general_chat" },
  // TYPO TOLERANCE (fix): "yeqildim" (typoli) va "nima qilsam bo'ladi" ham
  // general_chat bo'lishi kerak — admission (Qabul) yutib yubormasligi kerak!
  { msg: "men imtihondan yeqildim nima qilsam bo'ladi", expectIntent: "general_chat" },
  { msg: "imtihondan yiqilib, nima qilsam bo'ladi?", expectIntent: "general_chat" },
  { msg: "nima qilsam bo'ladi", expectIntent: "general_chat" },
  { msg: "imtihondan yiqildim", expectIntent: "general_chat" },
  // Aniq tavsiya triggerlari hali ham recommendation (whitelist saqlanadi)
  { msg: "universitet tavsiya qil", expectIntent: "recommendation" },
  { msg: "qaysi universitetni tanlasam", expectIntent: "recommendation" },
  { msg: "IT uchun universitet tavsiya qil", expectIntent: "recommendation", expectDir: "it" },
  // Reviewer fix: DATA intent'lar negativ so'z bo'lsa ham hijack qilinmaydi!
  // "maslahat bering" bilan tugasa ham grant_search real grant ma'lumotini beradi.
  { msg: "grant yutmoqchiman, maslahat bering", expectIntent: "grant_search" },
  { msg: "kontrakt narxlari haqida maslahat bering", expectIntent: "tuition_search" },
  { msg: "Toshkentdagi universitetlar bo'yicha maslahat bering", expectIntent: "university_search" },
];

let pass = 0;
let fail = 0;
let total = 0;

for (const c of cases) {
  const res = intentClassifier.classify(c.msg);
  // MUHIM: direction'ni normalizeText OLDINI tekshirmaymiz — klassifikator
  // typolarni ("daturchi" → "dasturchi") tuzatadi, shuning uchun entity'lar
  // orqali tekshiramiz (normalizatsiyadan keyingi natija).
  const dir = res.entities.direction || null;
  // Fix 11: expectEntities ko'rsatilgan bo'lsa, faqat entity'lar tekshiriladi
  // (intent aniqlanmagan bo'lishi mumkin — masalan yakka shahar nomi unknown).
  const okIntent = c.expectIntent === undefined ? true : res.intent === c.expectIntent;
  const okDir = !c.expectDir || dir === c.expectDir;
  const okEnt = !c.expectEntities || Object.entries(c.expectEntities)
    .every(([k, v]) => (res.entities as any)[k] === v);
  const ok = okIntent && okDir && okEnt;
  if (ok) pass++;
  else {
    fail++;
    console.log(`❌ "${c.msg}"`);
    console.log(`   intent=${res.intent} (expect ${c.expectIntent || "—"}) | dir=${dir} (expect ${c.expectDir || "—"}) | entities=${JSON.stringify(res.entities)} (expect ${JSON.stringify(c.expectEntities || {})})`);
  }
}

// ---- BOSQICH 2: Dynamic filtering — matchesAdvancedFilters helper tekshiruvlari ----
const filter = (uni: any, entities: any) =>
  (toolRouter as any).matchesAdvancedFilters(uni, entities);

const filterCases: Array<{ uni: any; entities: any; expect: boolean; label: string }> = [
  { uni: { degree: [{ id: 1 }], educationLanguage: [{ id: 2 }] }, entities: { degree: "bachelor", language: "english" }, expect: true, label: "bakalavr + ingliz" },
  { uni: { degree: [{ id: 2 }], educationLanguage: [{ id: 2 }] }, entities: { degree: "bachelor" }, expect: false, label: "magistr emas bakalavr" },
  { uni: { degree: [{ id: 1 }], educationLanguage: [{ id: 3 }] }, entities: { language: "english" }, expect: false, label: "rus emas ingliz" },
  { uni: { minimal_tuition_fee: 15000000, maximal_tuition_fee: 25000000 }, entities: { tuitionMax: 20000000 }, expect: true, label: "15-25 mln, 20 gacha" },
  { uni: { minimal_tuition_fee: 30000000 }, entities: { tuitionMax: 20000000 }, expect: false, label: "30 mln, 20 gacha emas" },
  { uni: { maximal_tuition_fee: 10000000 }, entities: { tuitionMin: 15000000 }, expect: false, label: "10 mln, 15 dan yuqori emas" },
  { uni: { degree: [{ id: 1 }], educationType: [{ id: 4 }] }, entities: { degree: "bachelor", educationType: "distance" }, expect: true, label: "bakalavr + masofaviy" },
  { uni: { degree: [1], educationLanguage: [2] }, entities: { degree: "bachelor", language: "english" }, expect: true, label: "raqamli array format" },
  { uni: { minimal_tuition_fee: 5000000 }, entities: { tuitionMax: 10000000, tuitionMin: 3000000 }, expect: true, label: "oraliq: 3-10 mln, 5 mln" },
  { uni: { degree: [{ id: 1 }] }, entities: { degree: "master" }, expect: false, label: "faqat bakalavr, magistr emas" },
  // LENIENT: ma'lumot bo'lmasa (bo'sh yoki null-id array) → filtermaymiz
  { uni: { degree: [] }, entities: { degree: "bachelor" }, expect: true, label: "degree bo'sh → o'tkaziladi" },
  { uni: { degree: [{ id: null }] }, entities: { degree: "bachelor" }, expect: true, label: "degree null-id → o'tkaziladi" },
  { uni: { educationLanguage: [{ id: null }] }, entities: { language: "english" }, expect: true, label: "language null-id → o'tkaziladi" },
  { uni: { degree: [] }, entities: { degree: "bachelor", tuitionMax: 20000000 }, expect: true, label: "degree yo'q + byudjet to'g'ri" },
];

for (const c of filterCases) {
  const ok = filter(c.uni, c.entities) === c.expect;
  if (ok) pass++;
  else {
    fail++;
    console.log(`❌ [Filter] ${c.label}`);
    console.log(`   uni=${JSON.stringify(c.uni)} entities=${JSON.stringify(c.entities)} → ${!c.expect} (expect ${c.expect})`);
  }
}

// ---- BOSQICH 3: Context Manager — egalik/ko'plik shakllari + follow-up zanjiri ----
// "davlatlari", "xususiylari", "xalqarolari", "bakalavrlari", "inglizchasiga" kabi
// yalang'och egalik shakllari to'g'ri intent/entity'ga tushishi kerak.
const possessiveCases: Array<{ msg: string; check: (e: any) => boolean; label: string }> = [
  { msg: "davlatlari", check: (e) => e.institutionCategory === "3", label: "davlatlari → davlat" },
  { msg: "xususiylari", check: (e) => e.institutionCategory === "4", label: "xususiylari → xususiy" },
  { msg: "xalqarolari", check: (e) => e.institutionCategory === "5", label: "xalqarolari → xalqaro" },
  { msg: "bakalavrlari", check: (e) => e.degree === "bachelor", label: "bakalavrlari → bachelor" },
  { msg: "magistrlari", check: (e) => e.degree === "master", label: "magistrlari → master" },
  { msg: "kunduzgilari", check: (e) => e.educationType === "full-time", label: "kunduzgilari → full-time" },
  { msg: "inglizchasiga", check: (e) => e.language === "english", label: "inglizchasiga → english" },
  { msg: "Toshkent shahri davlatlari", check: (e) => e.region === "14" && e.institutionCategory === "3", label: "hudud + davlatlari" },
  { msg: "itlari", check: (e) => e.direction === "it", label: "itlari → IT yo'nalishi" },
];

for (const c of possessiveCases) {
  const res = intentClassifier.classify(c.msg);
  const ok = c.check(res.entities);
  if (ok) pass++;
  else {
    fail++;
    console.log(`❌ [Possessive] "${c.msg}" (${c.label})`);
    console.log(`   intent=${res.intent} entities=${JSON.stringify(res.entities)}`);
  }
}

// Follow-up zanjiri: "Toshkentdagi universitetlar → ITlari → Davlatlari"
// Har bir qadamda kontekst boyib boradi (region → +direction → +category).
const chainCases: Array<{ label: string; msg: string; ctx: any; check: (r: any) => boolean }> = [
  {
    label: "1-qadam: Toshkentdagi universitetlar (region saqlanadi)",
    msg: "Toshkentdagi universitetlar",
    ctx: { language: "uz" },
    check: (r) => r.intent.intent === "university_search" && r.intent.entities.region === "14",
  },
  {
    label: "2-qadam: ITlari → region + direction",
    msg: "ITlari",
    ctx: { language: "uz", currentRegion: "14", currentTopicName: "Toshkent shahri" },
    check: (r) => r.intent.entities.region === "14" && r.intent.entities.direction === "it",
  },
  {
    label: "3-qadam: Davlatlari → region + direction + category",
    msg: "Davlatlari",
    ctx: { language: "uz", currentRegion: "14", currentDirectionCategory: "it", currentTopicName: "Toshkent shahri" },
    check: (r) => r.intent.entities.region === "14" && r.intent.entities.direction === "it" && r.intent.entities.institutionCategory === "3",
  },
  {
    label: "degree follow-up: bakalavrlari → degree qo'shiladi",
    msg: "bakalavrlari",
    ctx: { language: "uz", currentRegion: "14", currentDegree: "bachelor" },
    check: (r) => r.intent.entities.region === "14" && r.intent.entities.degree === "bachelor",
  },
  {
    label: "language follow-up: inglizchasiga → language qo'shiladi",
    msg: "inglizchasiga",
    ctx: { language: "uz", currentRegion: "14", currentLanguage: "english" },
    check: (r) => r.intent.entities.region === "14" && r.intent.entities.language === "english",
  },
  {
    label: "budget follow-up: 20 mln gachasi → tuitionMax qo'shiladi",
    msg: "20 mln gachasi",
    ctx: { language: "uz", currentRegion: "14", currentTuitionMax: 20000000 },
    check: (r) => r.intent.entities.region === "14" && r.intent.entities.tuitionMax === 20000000,
  },
  // YANGI MAVZU (Bug 2 fix): o'z-o'zidan to'liq so'rovlar follow-up ga QO'SHILMAYDI
  {
    label: "YANGI MAVZU: 'men doktor bo'lmoqchiman' → follow-up QO'SHILMAYDI",
    msg: "men doktor bo'lmoqchiman",
    ctx: { language: "uz", currentTopicName: "Davlat universitetlar", currentInstitutionCategory: "3", currentRegion: "14" },
    check: (r) => r.augmented === false && r.intent.intent === "direction_search" && r.intent.entities.direction === "tibbiyot",
  },
  {
    label: "YANGI MAVZU: 'tibbiyotga qiziqaman' → follow-up QO'SHILMAYDI",
    msg: "tibbiyotga qiziqaman",
    ctx: { language: "uz", currentTopicName: "Toshkent shahri", currentRegion: "14" },
    check: (r) => r.augmented === false && r.intent.intent === "direction_search",
  },
  {
    label: "YANGI MAVZU: 'dasturchi bo'lmoqchiman' → follow-up QO'SHILMAYDI",
    msg: "dasturchi bo'lmoqchiman",
    ctx: { language: "uz", currentTopicName: "Davlat universitetlar", currentInstitutionCategory: "3" },
    check: (r) => r.augmented === false && r.intent.intent === "direction_search" && r.intent.entities.direction === "it",
  },
  // Bug 1 fix: STAGE 2 mavzuni qayta qo'shmasligi kerak (double-append)
  {
    label: "BUG1: 'ITlari' → mavzu faqat BIR marta qo'shiladi",
    msg: "ITlari",
    ctx: { language: "uz", currentRegion: "14", currentTopicName: "Toshkent shahri" },
    check: (r) => (r.effectiveMessage.match(/Toshkent shahri/g) || []).length === 1 && r.augmented === true,
  },
  // BOSQICH 10 (Fix): "batafsil ma'lumot" follow-up → lastUniversity ga bog'lanadi
  {
    label: "FIX10: 'menga batafsil ma'lumot bera olasanmi?' → EMU universitetiga bog'lanadi (direction emas)",
    msg: "menga batafsil ma'lumot bera olasanmi",
    ctx: {
      language: "uz",
      currentDirectionCategory: "tibbiyot", // ESKI direction — yutilmasligi kerak!
      lastRecommendations: [{ id: 1, name: "EMU universiteti", slug: "emu-university" }],
    },
    check: (r) =>
      r.augmented === true &&
      r.effectiveMessage.startsWith("EMU universiteti") &&
      !r.effectiveMessage.startsWith("tibbiyot"),
  },
  {
    label: "FIX10: 'batafsilroq ayt' → lastUniversity ga bog'lanadi",
    msg: "batafsilroq ayt",
    ctx: {
      language: "uz",
      currentDirectionCategory: "it",
      lastRecommendations: [{ id: 2, name: "TATU", slug: "tatu" }],
    },
    check: (r) => r.augmented === true && r.effectiveMessage.startsWith("TATU"),
  },
  {
    label: "FIX10: 'IT haqida batafsil ma'lumot' → o'z yo'nalishi bor, hijack bo'lmaydi (context'da university bo'lsa ham)",
    msg: "IT haqida batafsil ma'lumot",
    ctx: {
      language: "uz",
      currentDirectionCategory: "tibbiyot",
      currentTopicName: "EMU universiteti",
      lastRecommendations: [{ id: 1, name: "EMU universiteti", slug: "emu-university" }],
    },
    check: (r) => !r.effectiveMessage.startsWith("EMU universiteti"),
  },
  {
    label: "FIX10: 'Toshkentdagi yotoqxonasi' → region bor, memory'ga yutilmaydi",
    msg: "Toshkentdagi yotoqxonasi",
    ctx: {
      language: "uz",
      lastRecommendations: [{ id: 1, name: "EMU universiteti", slug: "emu-university" }],
    },
    check: (r) => !r.effectiveMessage.startsWith("EMU universiteti"),
  },
  {
    label: "FIX10: 'menga ko'proq variant ber' → ko'proq variant so'rash, universitеt detail EMAS (hijack bo'lmaydi)",
    msg: "menga ko'proq variant ber",
    ctx: {
      language: "uz",
      lastRecommendations: [{ id: 1, name: "EMU universiteti", slug: "emu-university" }],
    },
    check: (r) => !r.effectiveMessage.startsWith("EMU universiteti"),
  },
  // BOSQICH 11 (Fix): universal last-university resolver — pronoun + plural attribute
  {
    label: "FIX11: 'uning narxlari qancha' → lastUniversity ga bog'lanadi (narxlari plural!)",
    msg: "uning narxlari qancha",
    ctx: {
      language: "uz",
      lastUniversity: { id: 25, name: "PDP University", slug: "pdp-university" },
    },
    check: (r) =>
      r.augmented === true &&
      r.effectiveMessage.startsWith("PDP University") &&
      r.intent.entities.university === "PDP University" &&
      r.intent.intent === "tuition_search",
  },
  {
    label: "FIX11: 'uning kontrakti qancha' → lastUniversity ga bog'lanadi",
    msg: "uning kontrakti qancha",
    ctx: {
      language: "uz",
      lastUniversity: { id: 25, name: "PDP University", slug: "pdp-university" },
    },
    check: (r) =>
      r.augmented === true &&
      r.effectiveMessage.startsWith("PDP University") &&
      r.intent.entities.university === "PDP University",
  },
  {
    label: "FIX11: 'telefoni' → lastUniversity ga bog'lanadi (attribute word yolg'iz)",
    msg: "telefoni",
    ctx: {
      language: "uz",
      lastUniversity: { id: 25, name: "PDP University", slug: "pdp-university" },
    },
    check: (r) =>
      r.augmented === true &&
      r.effectiveMessage.startsWith("PDP University") &&
      r.intent.entities.university === "PDP University",
  },
  {
    label: "FIX11: 'sayti' → lastUniversity ga bog'lanadi",
    msg: "sayti",
    ctx: {
      language: "uz",
      lastUniversity: { id: 25, name: "PDP University", slug: "pdp-university" },
    },
    check: (r) =>
      r.augmented === true &&
      r.effectiveMessage.startsWith("PDP University") &&
      r.intent.entities.university === "PDP University",
  },
  {
    label: "FIX11: 'u haqida ayt' → pronoun 'u' lastUniversity ga bog'lanadi",
    msg: "u haqida ayt",
    ctx: {
      language: "uz",
      lastUniversity: { id: 25, name: "PDP University", slug: "pdp-university" },
    },
    check: (r) =>
      r.augmented === true &&
      r.effectiveMessage.startsWith("PDP University") &&
      r.intent.entities.university === "PDP University",
  },
  {
    label: "FIX11: 'shu universitetda nima bor' → pronoun + university so'zi YANGI MAVZU (hijack bo'lmaydi)",
    msg: "shu universitetda nima bor",
    ctx: {
      language: "uz",
      lastUniversity: { id: 25, name: "PDP University", slug: "pdp-university" },
    },
    check: (r) => !r.effectiveMessage.startsWith("PDP University"),
  },
  {
    label: "FIX11: 'shu yo'nalishda qanday grantlar bor' → yo'nalish konteksti, university'ga bog'lanmaydi",
    msg: "shu yo'nalishda qanday grantlar bor",
    ctx: {
      language: "uz",
      lastUniversity: { id: 25, name: "PDP University", slug: "pdp-university" },
    },
    check: (r) => !r.effectiveMessage.startsWith("PDP University"),
  },
  {
    label: "FIX11: 'uning narxlari qancha' lastUniversity bo'lmasa → bog'lanmaydi",
    msg: "uning narxlari qancha",
    ctx: { language: "uz" },
    check: (r) => !r.effectiveMessage.startsWith("PDP University") && !r.effectiveMessage.includes("PDP"),
  },
  // REVIEWER FIX: kuchsiz olmoshlar ("shu", "u") false-positive bo'lmasligi kerak
  {
    label: "FIX11R: 'shu yil o'qishga kirmoqchiman' → 'shu' = 'bu yil', university'ga bog'lanmaydi",
    msg: "shu yil o'qishga kirmoqchiman",
    ctx: {
      language: "uz",
      lastUniversity: { id: 25, name: "PDP University", slug: "pdp-university" },
    },
    check: (r) => !r.effectiveMessage.startsWith("PDP University"),
  },
  {
    label: "FIX11R: 'u yerda o'qiyman' → 'u' = 'u yerda' (there), university'ga bog'lanmaydi",
    msg: "u yerda o'qiyman",
    ctx: {
      language: "uz",
      lastUniversity: { id: 25, name: "PDP University", slug: "pdp-university" },
    },
    check: (r) => !r.effectiveMessage.startsWith("PDP University"),
  },
  {
    label: "FIX11R: 'shu haqida ayt' → 'shu' + 'haqida' referensial, university'ga bog'lanadi",
    msg: "shu haqida ayt",
    ctx: {
      language: "uz",
      lastUniversity: { id: 25, name: "PDP University", slug: "pdp-university" },
    },
    check: (r) =>
      r.augmented === true && r.effectiveMessage.startsWith("PDP University"),
  },
  {
    label: "FIX11R: 'uning yo'nalishlari qancha' → university attribute (Context Resolver yo'li)",
    msg: "uning yo'nalishlari qancha",
    ctx: {
      language: "uz",
      lastUniversity: { id: 25, name: "PDP University", slug: "pdp-university" },
    },
    check: (r) =>
      r.augmented === true && r.effectiveMessage.startsWith("PDP University"),
  },
  // BOSQICH 12 (Response Composer): field request + lastUniversity
  {
    label: "FIX12: 'telefoni' → lastUniversity ga bog'lanadi (field request)",
    msg: "telefoni",
    ctx: {
      language: "uz",
      lastUniversity: { id: 25, name: "PDP University", slug: "pdp-university" },
    },
    check: (r) =>
      r.augmented === true &&
      r.effectiveMessage.startsWith("PDP University") &&
      r.intent.entities.university === "PDP University",
  },
  {
    label: "FIX12: 'narxlari qancha' → lastUniversity ga bog'lanadi (tuition field)",
    msg: "narxlari qancha",
    ctx: {
      language: "uz",
      lastUniversity: { id: 25, name: "PDP University", slug: "pdp-university" },
    },
    check: (r) =>
      r.augmented === true &&
      r.effectiveMessage.startsWith("PDP University") &&
      r.intent.entities.university === "PDP University",
  },
  // BOSQICH 13 (Conversation Repair + Recommendation Navigation)
  {
    label: "FIX13: 'Yo'q, men EMUni aytgandim' → lastUniversity EMU ga almashtiriladi",
    msg: "Yo'q, men EMUni aytgandim",
    ctx: {
      language: "uz",
      lastUniversity: { id: 25, name: "PDP University", slug: "pdp-university" },
    },
    check: (r) =>
      r.augmented === true &&
      r.intent.entities.university === "EMU" &&
      r.ctx?.lastUniversity?.name === "EMU",
  },
  {
    label: "FIX13: 'Yo'q, TATUni nazarda tutdim' → lastUniversity TATU ga almashtiriladi",
    msg: "Yo'q, TATUni nazarda tutdim",
    ctx: {
      language: "uz",
      lastUniversity: { id: 25, name: "PDP University", slug: "pdp-university" },
    },
    check: (r) =>
      r.augmented === true &&
      r.intent.entities.university === "TATU" &&
      r.ctx?.lastUniversity?.name === "TATU",
  },
  {
    label: "FIX13: 'yo'q, xususiy kerak' → university entity yo'q, repair emas (category javob)",
    msg: "yo'q, xususiy kerak",
    ctx: {
      language: "uz",
      lastUniversity: { id: 25, name: "PDP University", slug: "pdp-university" },
    },
    check: (r) => !r.augmented || !r.intent.entities.university,
  },
  {
    label: "FIX13: 'ikkinchisi-chi?' → lastRecommendations[1] ga bog'lanadi (PDP)",
    msg: "ikkinchisi-chi",
    ctx: {
      language: "uz",
      lastRecommendations: [
        { id: 1, name: "TATU", slug: "tatu" },
        { id: 2, name: "PDP University", slug: "pdp-university" },
      ],
    },
    check: (r) =>
      r.augmented === true &&
      r.effectiveMessage.startsWith("PDP University") &&
      r.intent.entities.university === "PDP University",
  },
  {
    label: "FIX13: 'keyingisi-chi?' → lastRecommendations[1] ga bog'lanadi",
    msg: "keyingisi-chi",
    ctx: {
      language: "uz",
      lastRecommendations: [
        { id: 1, name: "TATU", slug: "tatu" },
        { id: 2, name: "INHA", slug: "inha" },
      ],
    },
    check: (r) =>
      r.augmented === true &&
      r.effectiveMessage.startsWith("INHA") &&
      r.intent.entities.university === "INHA",
  },
  {
    label: "FIX13: 'uchinchisi-chi?' → lastRecommendations[2] ga bog'lanadi",
    msg: "uchinchisi-chi",
    ctx: {
      language: "uz",
      lastRecommendations: [
        { id: 1, name: "TATU", slug: "tatu" },
        { id: 2, name: "PDP University", slug: "pdp-university" },
        { id: 3, name: "INHA", slug: "inha" },
      ],
    },
    check: (r) =>
      r.augmented === true &&
      r.effectiveMessage.startsWith("INHA") &&
      r.intent.entities.university === "INHA",
  },
  {
    label: "FIX13: 'ikkinchisi-chi?' faqat 1 ta tavsiya bo'lsa → bog'lanmaydi",
    msg: "ikkinchisi-chi",
    ctx: {
      language: "uz",
      lastRecommendations: [{ id: 1, name: "TATU", slug: "tatu" }],
    },
    check: (r) => !r.augmented || !r.effectiveMessage.includes("TATU"),
  },
  // REVIEWER FIX: repair false-positive'lari
  {
    label: "FIX13R: 'yo'q, Toshkentdagi davlat universiteti kerak' → repair EMAS (yangi so'rov)",
    msg: "yo'q, Toshkentdagi davlat universiteti kerak",
    ctx: {
      language: "uz",
      lastUniversity: { id: 25, name: "PDP University", slug: "pdp-university" },
    },
    check: (r) =>
      !r.augmented ||
      (r.intent.entities.university !== "Toshkentdagi davlat universiteti" &&
        r.ctx?.lastUniversity?.name === "PDP University"),
  },
  {
    label: "FIX13R: 'yo'q, PDP kerak emas' → rad etish, repair EMAS",
    msg: "yo'q, PDP kerak emas",
    ctx: {
      language: "uz",
      lastUniversity: { id: 25, name: "TATU", slug: "tatu" },
    },
    check: (r) => !r.augmented || r.ctx?.lastUniversity?.name === "TATU",
  },
  {
    label: "FIX13R: 'yo'q, men Toshkent tibbiyot akademiyasini aytgandim' → toza nom (men qo'shilmaydi)",
    msg: "yo'q, men Toshkent tibbiyot akademiyasini aytgandim",
    ctx: {
      language: "uz",
      lastUniversity: { id: 25, name: "PDP University", slug: "pdp-university" },
    },
    check: (r) => {
      const uni = r.ctx?.lastUniversity?.name || "";
      return (
        uni.includes("Toshkent tibbiyot akademiyasi") &&
        !uni.startsWith("men ") &&
        !uni.startsWith("yo'q")
      );
    },
  },
  // BOSQICH 14 (Explanation): "Nega aynan X?" intent aniqlash
  {
    label: "FIX14: 'nega aynan TATU' → explanation intent + university=TATU",
    msg: "nega aynan TATU",
    ctx: { language: "uz" },
    check: (r) => r.intent.intent === "explanation" && r.intent.entities.university === "TATU",
  },
  {
    label: "FIX14: 'nima uchun shu' → explanation intent",
    msg: "nima uchun shu",
    ctx: { language: "uz" },
    check: (r) => r.intent.intent === "explanation",
  },
  {
    label: "FIX14: 'nega aynan shu universitet' → explanation (university_search EMAS)",
    msg: "nega aynan shu universitet",
    ctx: { language: "uz" },
    check: (r) => r.intent.intent === "explanation",
  },
  {
    label: "FIX14: 'tavsiya sababi nima' → explanation (recommendation EMAS)",
    msg: "tavsiya sababi nima",
    ctx: { language: "uz" },
    check: (r) => r.intent.intent === "explanation",
  },
  {
    label: "FIX14: 'nega aynan TATUni tavsiya qilding' → explanation (recommendation EMAS)",
    msg: "nega aynan TATUni tavsiya qilding",
    ctx: { language: "uz" },
    check: (r) => r.intent.intent === "explanation",
  },
  // LONG-TEST (BOSQICH 14, davomi): uzun tavsiya so'rovi + "nima uchun...tushuntiring"
  // iborasi explanation'ga yutib yubormasligi kerak — asosiy maqsad TAVSIYA.
  {
    label: "LONG-TEST: uzun tavsiya so'rovi (tavsiya qilib bering + tushuntiring) → recommendation",
    msg: "Men bu yil o'qishga kirmoqchiman, Samarqandda yashayman, matematikam unchalik yaxshi emas lekin informatika va sun'iy intellektga juda qiziqaman, ingliz tilim B2 darajasida, byudjetim 20 million so'mgacha, grant imkoniyati bo'lsa yanada yaxshi, yotoqxonasi bo'lishi kerak. Menga eng mos universitetlarni tavsiya qilib bering va nima uchun aynan shularni tanlaganingizni tushuntiring.",
    ctx: { language: "uz" },
    check: (r) => r.intent.intent === "recommendation",
  },
  {
    label: "LONG-TEST: 'Birinchi tavsiya qilingan universitеt haqida batafsil ma'lumot bering' → university_detail (recommendation EMAS)",
    msg: "Birinchi tavsiya qilingan universitеt haqida batafsil ma'lumot bering",
    ctx: { language: "uz" },
    check: (r) => r.intent.intent === "university_detail",
  },
  {
    label: "LONG-TEST: 'nega TATUni tavsiya qilib berdingiz' o'tgan zamon → explanation",
    msg: "nega TATUni tavsiya qilib berdingiz",
    ctx: { language: "uz" },
    check: (r) => r.intent.intent === "explanation",
  },
  {
    label: "LONG-TEST: 'tavsiya qiling' buyruq mayli → recommendation",
    msg: "tavsiya qiling",
    ctx: { language: "uz" },
    check: (r) => r.intent.intent === "recommendation",
  },
  {
    label: "LONG-TEST: 'tavsiya bering' buyruq mayli → recommendation",
    msg: "tavsiya bering",
    ctx: { language: "uz" },
    check: (r) => r.intent.intent === "recommendation",
  },
  {
    label: "LONG-TEST: 'Keyingisi-chi? Uning ham afzalliklari nima?' → nav (university_detail)",
    msg: "Keyingisi-chi? Uning ham afzalliklari nima?",
    ctx: {
      language: "uz",
      lastRecommendations: [
        { name: "Samarqand davlat tibbiyot universiteti", slug: "samarqand-davlat-tibbiyot-universiteti" },
        { name: "Toshkent tibbiyot akademiyasi", slug: "toshkent-tibbiyot-akademiyasi" },
      ],
    },
    check: (r) => r.intent.intent === "university_detail" && (r.effectiveMessage || "").includes("Toshkent tibbiyot akademiyasi"),
  },
];

// ---- BOSQICH 14: Conversation Snapshot testlari ----
const longHistory = Array.from({ length: 20 }, (_, i) => ({
  id: `m${i}`,
  role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
  content: i === 0 ? "A" : `Xabar raqami ${i} — bu juda uzun matn ${"a".repeat(50)}`,
  timestamp: new Date().toISOString(),
}));
const snap = buildSnapshotHistory(longHistory as any);
// Snapshot MAQSADI: eski xabarlar qisqartiriladi, jami 10 (snapshot) + 6 (to'liq) = 16
if (snap.length === 16) pass++;
else { fail++; console.log(`❌ [Snapshot] xabarlar 16 ta bo'lishi kerak (${snap.length})`); }
const oldSnapped = snap[0];
if (oldSnapped.content.length <= 101) pass++;
else { fail++; console.log(`❌ [Snapshot] eski xabar qisqartirilmadi (${oldSnapped.content.length} belgi)`); }
const lastFull = snap[snap.length - 1];
if (lastFull.content === longHistory[longHistory.length - 1].content) pass++;
else { fail++; console.log(`❌ [Snapshot] oxirgi xabar TO'LIQ saqlanishi kerak`); }
const shortHist = longHistory.slice(0, 10);
if (buildSnapshotHistory(shortHist as any).length === 10) pass++;
else { fail++; console.log(`❌ [Snapshot] qisqa history o'zgarmasligi kerak`); }


// ---- BOSQICH 12: Request Field Detector testlari ----
const fieldCases: Array<{ msg: string; expected: string | null; label: string }> = [
  { msg: "uning telefoni qancha", expected: "phone", label: "phone" },
  { msg: "narxlari qancha", expected: "tuition", label: "tuition narxlari" },
  { msg: "kontrakti qancha", expected: "tuition", label: "tuition kontrakti" },
  { msg: "yotoqxonasi bormi", expected: "hostel", label: "hostel" },
  { msg: "granti bormi", expected: "grant", label: "grant" },
  { msg: "qabuli ochilganmi", expected: "admission", label: "admission" },
  { msg: "sayti qanday", expected: "website", label: "website" },
  { msg: "elektron pochtasi qanday", expected: "email", label: "email" },
  { msg: "manzili qayerda", expected: "address", label: "address" },
  { msg: "haqida ma'lumot ber", expected: "summary", label: "summary" },
  { msg: "grantlar bormi", expected: null, label: "grantlar (ko'plik) → field EMAS" },
  { msg: "kontraktlar bormi", expected: null, label: "kontraktlar (ko'plik) → field EMAS" },
];
for (const c of fieldCases) {
  total++;
  const got = detectRequestField(c.msg);
  const ok = got === c.expected;
  if (ok) pass++;
  else {
    fail++;
    console.log(`❌ [Field] ${c.label}: "${c.msg}" → expected=${c.expected}, got=${got}`);
  }
}

const bareCases: Array<{ msg: string; expected: boolean; label: string }> = [
  { msg: "kontrakti qancha", expected: true, label: "bare: kontrakti qancha" },
  { msg: "telefoni", expected: true, label: "bare: telefoni" },
  { msg: "narxlari", expected: true, label: "bare: narxlari" },
  { msg: "PDP kontrakti", expected: false, label: "PDP bor → bare EMAS" },
  { msg: "Toshkentdagi kontrakti", expected: false, label: "region bor → bare EMAS" },
  { msg: "uning narxlari", expected: true, label: "uning narxlari → bare (pronoun context'da resolver ishlaydi)" },
  { msg: "kontrakti 20 mln gacha bo'lganlar", expected: false, label: "budjet bor → bare EMAS" },
];
for (const c of bareCases) {
  total++;
  const got = isBareFieldRequest(c.msg);
  const ok = got === c.expected;
  if (ok) pass++;
  else {
    fail++;
    console.log(`❌ [Bare] ${c.label}: "${c.msg}" → expected=${c.expected}, got=${got}`);
  }
}

for (const c of chainCases) {
  const res = augmentFollowUp(c.msg, c.ctx, [], "uz");
  // check funksiyasiga ctx ham uzatiladi — Conversation Repair (FIX13)
  // sessionContext mutatsiyasini tekshiradi (ctxUpdated maydonisiz).
  const ok = c.check({ ...res, ctx: c.ctx });
  if (ok) pass++;
  else {
    fail++;
    console.log(`❌ [Chain] ${c.label}`);
    console.log(`   "${c.msg}" → effective="${res.effectiveMessage}" intent=${res.intent.intent} entities=${JSON.stringify(res.intent.entities)}`);
  }
}

// ---- BOSQICH 1: Entity-First — entity extraction tekshiruvlari ----
const entityCases: Array<{ msg: string; check: (e: any) => boolean; label: string }> = [
  { msg: "20 mln gacha bo'lgan xususiy tibbiyot universitetlari", check: (e) => e.tuitionMax === 20000000 && e.institutionCategory === "4" && e.direction === "tibbiyot", label: "byudjet max + kategoriya + yo'nalish" },
  { msg: "15 mln dan yuqori kontraktli universitetlar", check: (e) => e.tuitionMin === 15000000, label: "byudjet min" },
  { msg: "15 dan 30 mln gacha bo'lganlar", check: (e) => e.tuitionMin === 15000000 && e.tuitionMax === 30000000, label: "byudjet oralig'i" },
  { msg: "$5000 gacha bo'lgan universitetlar", check: (e) => e.tuitionMax === 5000 * 12800, label: "dollar byudjet" },
  { msg: "$5,000 gacha bo'lganlar", check: (e) => e.tuitionMax === 5000 * 12800, label: "dollar minglik ajratgichi" },
  { msg: "stomatologiya fakulteti bor universitetlar", check: (e) => e.faculty === "stomatologiya", label: "fakultet" },
  { msg: "qabul deadline'i qachon", check: (e) => e.deadline === "deadline", label: "deadline" },
  { msg: "grant yangiliklari", check: (e) => e.newsCategory === "grant", label: "yangilik kategoriyasi" },
  { msg: "stipendiyali universitetlar", check: (e) => e.hasStipend === true, label: "stipendiya" },
];

for (const c of entityCases) {
  const res = intentClassifier.classify(c.msg);
  const ok = c.check(res.entities);
  if (ok) pass++;
  else {
    fail++;
    console.log(`❌ [Entity] "${c.msg}" (${c.label})`);
    console.log(`   entities=${JSON.stringify(res.entities)}`);
  }
}

// ---- BOSQICH 4: JSON-driven config — intent-config.json dan o'qiladigan intent'lar ----
// 1) Config validatsiyasi: barcha pattern'lar compile bo'lishi, handler/tool mavjudligi
const configValidation = validateIntentConfig();
if (configValidation.errors.length === 0) pass++;
else {
  fail++;
  console.log(`❌ [Config] intent-config.json validatsiya xatolari (${configValidation.errors.length} ta):`);
  configValidation.errors.slice(0, 5).forEach((e) => console.log(`   ${e}`));
}

// 2) university_detail — JSON-only yangi intent (kodga tegmasdan qo'shilgan!)
const detailCases: Array<{ msg: string; expectIntent: string; label: string }> = [
  { msg: "Amity universiteti haqida batafsil ma'lumot", expectIntent: "university_detail", label: "batafsil ma'lumot → university_detail" },
  { msg: "TATU manzili qayerda", expectIntent: "university_detail", label: "manzil so'rovi → university_detail" },
  { msg: "universiteti qayerda joylashgan", expectIntent: "university_detail", label: "qayerda joylashgan → university_detail" },
  { msg: "kontaktlari bormi", expectIntent: "university_detail", label: "kontakt so'rovi → university_detail" },
];

for (const c of detailCases) {
  const res = intentClassifier.classify(c.msg);
  const ok = res.intent === c.expectIntent;
  if (ok) pass++;
  else {
    fail++;
    console.log(`❌ [Detail] "${c.msg}" (${c.label})`);
    console.log(`   intent=${res.intent} (expect ${c.expectIntent})`);
  }
}

// 2b) university_detail + direction keyword/interest → direction_search (Step 2a/2c override)
// MUHIM: university_detail university_search'ning egizagi — direction override'lari ham ishlashi kerak
const detailOverrideCases: Array<{ msg: string; expectIntent: string; label: string }> = [
  { msg: "batafsil IT ga qiziqaman", expectIntent: "direction_search", label: "batafsil + IT → direction_search (2a override)" },
  { msg: "tibbiyotga qiziqaman batafsil", expectIntent: "direction_search", label: "tibbiyot + batafsil → direction_search (2c override)" },
];

for (const c of detailOverrideCases) {
  const res = intentClassifier.classify(c.msg);
  const ok = res.intent === c.expectIntent;
  if (ok) pass++;
  else {
    fail++;
    console.log(`❌ [DetailOverride] "${c.msg}" (${c.label})`);
    console.log(`   intent=${res.intent} (expect ${c.expectIntent})`);
  }
}

// 3) Handler mapping — intent-config.json dagi 'handler' → tool-router dispatch
const handlerCases: Array<{ intent: string; expectHandler: string; label: string }> = [
  { intent: "university_search", expectHandler: "search_university", label: "university_search → search_university" },
  { intent: "university_detail", expectHandler: "search_university", label: "university_detail → search_university" },
  { intent: "university_list", expectHandler: "search_university", label: "university_list → search_university" },
  { intent: "direction_search", expectHandler: "search_direction", label: "direction_search → search_direction" },
  { intent: "direction_list", expectHandler: "list_directions", label: "direction_list → list_directions" },
  { intent: "grant_search", expectHandler: "search_grants", label: "grant_search → search_grants" },
  { intent: "grant_list", expectHandler: "search_grants", label: "grant_list → search_grants" },
  { intent: "news_search", expectHandler: "search_news", label: "news_search → search_news" },
  { intent: "news_list", expectHandler: "search_news", label: "news_list → search_news" },
  { intent: "tuition_search", expectHandler: "search_tuition", label: "tuition_search → search_tuition" },
  { intent: "comparison", expectHandler: "compare_universities", label: "comparison → compare_universities" },
  { intent: "recommendation", expectHandler: "recommend", label: "recommendation → recommend" },
  { intent: "admission", expectHandler: "get_admission", label: "admission → get_admission" },
  { intent: "transfer", expectHandler: "get_transfer", label: "transfer → get_transfer" },
  { intent: "greeting", expectHandler: "none", label: "greeting → none" },
  { intent: "faq", expectHandler: "none", label: "faq → none" },
];

for (const c of handlerCases) {
  const ok = getIntentHandler(c.intent) === c.expectHandler;
  if (ok) pass++;
  else {
    fail++;
    console.log(`❌ [Handler] ${c.label}`);
    console.log(`   handler=${getIntentHandler(c.intent)} (expect ${c.expectHandler})`);
  }
}

// 4) Flag'lar (dataIntent / selfComplete) + tool mapping — hammasi config'dan
const flagCases: Array<{ check: boolean; label: string }> = [
  { check: getIntentDataFlag("university_detail") === true, label: "university_detail dataIntent=true" },
  { check: getIntentDataFlag("admission") === false, label: "admission dataIntent=false" },
  { check: getIntentDataFlag("direction_list") === true, label: "direction_list dataIntent=true" },
  { check: getSelfCompleteIntents().includes("direction_list"), label: "direction_list selfComplete=true" },
  { check: !getSelfCompleteIntents().includes("university_search"), label: "university_search selfComplete=false" },
  { check: getIntentTool("admission") === "get_university", label: "admission tool=get_university" },
  { check: ALL_INTENTS.includes("university_detail"), label: "university_detail config'da bor" },
];

for (const c of flagCases) {
  if (c.check) pass++;
  else {
    fail++;
    console.log(`❌ [Flag] ${c.label}`);
  }
}

// ---- BOSQICH 5: LLM entity parsing — parseEntitiesJSON (pure funksiya) ----
// LLM javobini validatsiya qilish qoidalari: fence tozalash, nom→id, alias,
// mln heuristikasi, noto'g'ri kalitlarni filtrlash, garbage → null.
const llmParseCases: Array<{ input: string; msg: string; check: (e: any) => boolean; label: string }> = [
  {
    input: '{"region":"14","institutionCategory":"4","direction":"tibbiyot","tuitionMax":20000000}',
    msg: "Toshkentdagi xususiy tibbiyot 20 mln gacha",
    check: (e) => e.region === "14" && e.institutionCategory === "4" && e.direction === "tibbiyot" && e.tuitionMax === 20000000,
    label: "to'liq valid JSON",
  },
  {
    input: '```json\n{"degree":"bachelor","language":"english"}\n```',
    msg: "ingliz bakalavr",
    check: (e) => e.degree === "bachelor" && e.language === "english",
    label: "fenced JSON (```json)",
  },
  {
    input: '{"region":"Toshkent shahri","accommodation":"true"}',
    msg: "toshkent yotoqxonali",
    check: (e) => e.region === "14" && e.accommodation === "true",
    label: "region nomi → id (14)",
  },
  {
    input: '{"tuitionMax":"20 mln"}',
    msg: "20 mln gacha",
    check: (e) => e.tuitionMax === 20000000,
    label: "string miqdor + mln heuristikasi",
  },
  {
    input: '{"evilKey":"x","university":"Amity Universiteti"}',
    msg: "amity",
    check: (e) => (e as any).evilKey === undefined && e.university === "Amity Universiteti",
    label: "noto'g'ri kalitlar filtrlanadi",
  },
  {
    input: "bu json emas, hech narsa",
    msg: "nima",
    check: (e) => e === null,
    label: "garbage → null",
  },
  {
    input: '{"direction":"IT","degree":"BAKALAVR","language":"INGLIZ"}',
    msg: "IT bakalavr ingliz",
    check: (e) => e.direction === "it" && e.degree === "bachelor" && e.language === "english",
    label: "alias + case normalizatsiyasi",
  },
  {
    input: '{"region":"Samarqand","institutionCategory":"davlat"}',
    msg: "samarqand davlat",
    check: (e) => e.region === "8" && e.institutionCategory === "3",
    label: "region nomi + davlat → 3",
  },
  {
    input: '{}',
    msg: "salom",
    check: (e) => e !== null && Object.keys(e).length === 0,
    label: "bo'sh object → bo'sh entity",
  },
];

for (const c of llmParseCases) {
  const res = parseEntitiesJSON(c.input, c.msg);
  const ok = c.check(res);
  if (ok) pass++;
  else {
    fail++;
    console.log(`❌ [LLMParse] ${c.label}`);
    console.log(`   input="${c.input}" → ${JSON.stringify(res)}`);
  }
}

// ---- TYPO TOLERANCE (tool-router keyword extraction) ----
// "daturchi bolmoqchiman" → classifier direction_search(it) ✅, LEKIN tool
// RAW "daturchi" bilan qidirsa bo'sh natija chiqadi. Normalizatsiyadan
// keyin keyword "dasturchi" bo'lib, IT kategoriyasiga kengayadi.
const typoToolCases: Array<{ msg: string; check: (k: string) => boolean; label: string }> = [
  {
    msg: "daturchi bolmoqchiman",
    check: (k) => /dasturchi/.test(k) && !/daturchi/.test(k),
    label: "daturchi → dasturchi (tool keyword)",
  },
  {
    msg: "kantrakt narxlaari qancha",
    check: (k) => /kontrakt/.test(k) && /narxlari/.test(k),
    label: "kantrakt narxlaari → kontrakt narxlari (tool keyword)",
  },
];

const extractKeywordFromMessage = (msg: string): string => {
  const normalized = normalizeUserText(msg);
  return normalized
    .replace(/\b(bilsan?mi|men|ga|ni|ning|da|dan|bilan|uchun|kerak|bor|haqida|qiziqaman|qiziqasiz|qiziqadi|qarayman|izlayman|top|ayt|ber|ko'rsat|universitet|universitetni|tavsiya|maslahat|bering|bersan(gizmi)?|bermoqchi)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

for (const c of typoToolCases) {
  const keyword = extractKeywordFromMessage(c.msg);
  const ok = c.check(keyword);
  if (ok) pass++;
  else {
    fail++;
    console.log(`❌ [TypoTool] ${c.label}`);
    console.log(`   "${c.msg}" → keyword="${keyword}"`);
  }
}

// ---- ENTITY VALIDATION (BOSQICH 8): bogus university entity bo'lmasligi kerak ----
// "IT uchun universitet tavsiya qil" → university="it uchun universitet" EMAS!
// "Salom. Men bu yil imtihondan yiqildim..." → butun gap university EMAS!
const entityValidationCases: Array<{ msg: string; check: (e: any) => boolean; label: string }> = [
  {
    msg: "IT uchun universitet tavsiya qil",
    check: (e) => e.university === undefined && e.direction === "it",
    label: "bogus 'it uchun universitet' qabul qilinmaydi",
  },
  {
    msg: "Salom. Men bu yil imtihondan yiqildim, lekin universitetda o'qishni orzu qilaman. Qanday maslahat berasan?",
    check: (e) => e.university === undefined,
    label: "butun gap university emas",
  },
  {
    msg: "Toshkent tibbiyot akademiyasi haqida ma'lumot",
    check: (e) => e.university === "toshkent tibbiyot akademiya",
    label: "haqiqiy nom saqlanadi (suffix -si ajratiladi)",
  },
  {
    msg: "Toshkent shahridagi Amity Universiteti",
    check: (e) => e.university === "AMITY",
    label: "Amity abbreviation saqlanadi",
  },
];

for (const c of entityValidationCases) {
  const res = intentClassifier.classify(c.msg);
  const ok = c.check(res.entities);
  if (ok) pass++;
  else {
    fail++;
    console.log(`❌ [EntityValidation] "${c.msg}" (${c.label})`);
    console.log(`   entities=${JSON.stringify(res.entities)}`);
  }
}

// ---- BOSQICH 8: Formatter — general_chat template mavjud, greeting hijack yo'q ----
// "Salom. ..." bilan boshlanuvchi UZUN xabar greeting template qaytarmasligi kerak
const formatterCases: Array<{ msg: string; intent: string; check: (r: string) => boolean; label: string }> = [
  {
    msg: "Salom. Men bu yil imtihondan yiqildim, lekin universitetda o'qishni orzu qilaman. Qanday maslahat berasan?",
    intent: "general_chat",
    check: (r) => /Sizni tushunaman/i.test(r) && !/Assalomu alaykum/.test(r),
    label: "general_chat → generalChatResponse (greeting emas)",
  },
  {
    msg: "salom",
    intent: "greeting",
    check: (r) => /Assalomu alaykum|Mentalaba AI/.test(r),
    label: "salom → greetingResponse",
  },
  {
    msg: "rahmat",
    intent: "thanks",
    check: (r) => /Rahmat|yordam/i.test(r),
    label: "rahmat → thanksResponse",
  },
];

for (const c of formatterCases) {
  const res = responseBuilder.build({ intent: c.intent, toolResults: [], message: c.msg, language: "uz" });
  const ok = c.check(res);
  if (ok) pass++;
  else {
    fail++;
    console.log(`❌ [Formatter] "${c.msg}" (${c.label})`);
    console.log(`   response=${JSON.stringify(res.substring(0, 120))}`);
  }
}

const configCheckCount = 1; // validateIntentConfig
console.log(`\n📊 NATIJA: ${pass} ✅ / ${fail} ❌ / jami ${cases.length + entityCases.length + filterCases.length + possessiveCases.length + chainCases.length + detailCases.length + detailOverrideCases.length + handlerCases.length + flagCases.length + llmParseCases.length + typoToolCases.length + entityValidationCases.length + formatterCases.length + configCheckCount + fieldCases.length + bareCases.length + 4 /* snapshot */}`);
console.log("\n--- helper checks ---");
console.log(`hasDirectionMention("meditsina") = ${hasDirectionMention("meditsina")} (expect true)`);
console.log(`hasDirectionMention("tibbiyotga") = ${hasDirectionMention("tibbiyotga")} (expect true)`);
console.log(`hasInterestPhrase("qiziqaman") = ${hasInterestPhrase("qiziqaman")} (expect true)`);
console.log(`hasInterestPhrase("salom") = ${hasInterestPhrase("salom")} (expect false)`);

process.exit(fail > 0 ? 1 : 0);
