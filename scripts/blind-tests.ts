/**
 * MENTALABA AI — BLIND ADVERSARIAL TEST SUITE (STAGE 18)
 *
 * Regression testlari (regression-intents.ts) muallif yozgan stsenariylarni
 * tekshiradi — agent ularga "o'rganib qolishi" mumkin. Bu SUITE esa alohida
 * yozilgan, TABIIY va tartibsiz so'zlashuvdagi user gaplarini tekshiradi:
 * real foydalanuvchi shunday yozadi (qisqa, chalkash, typosiz emas, aralash).
 *
 *   npx tsx scripts/blind-tests.ts
 *
 * Qamrov (≈280):
 *   A. Tabiiy so'zlashuv (55)  — kasb maqsadi, oila, kundalik gap
 *   B. Typo (35)               — real xato yozuvlar
 *   C. Negativ/qarama-qarshilik (40)
 *   D. Noaniq/ambiguous (35)
 *   E. Recommendation kombinatsiyalari (50)
 *   F. Multi-turn zanjirlar (35)
 *   G. Comparison/detail/navigation (30)
 *
 * Chiqish kodi: 0 = hammasi o'tdi, 1 = kamida bittasi muvaffaqiyatsiz.
 */
import { intentClassifier } from "../src/ai-agent/intent-classifier";
import {
  isSituationalRecommendation,
  updateRecommendationProfile,
} from "../src/ai-agent/follow-up-context";
import type { IntentResult, SessionContext } from "../src/types";

// ============================================================
// TURLAR
// ============================================================

interface BlindCase {
  msg: string;
  want: string;
  /** Kutilgan YAKUNIY intent (isSituationalRecommendation'dan keyin) */
  intent?: string;
  /** Bu intent(lar) BO'LMASLIGI kerak */
  mustNotIntent?: string[];
  /** Yo'nalish false positive bo'lmasligi kerak (masalan pedagogika) */
  noDirection?: string[];
  /** Kutilgan yo'nalish */
  direction?: string;
  /** Kategoriya bo'lmasligi kerak (befarqlik) */
  noCategory?: boolean;
  /** Kutilgan kategoriya */
  category?: string;
  /** Kutilgan byudjet (tuitionMax) */
  budget?: number;
}

interface TurnChain {
  turns: string[];
  want: string;
  /** Oxirgi turnning kutilgan yakuniy intenti */
  finalIntent: string;
  /** Oxirgi turnda profilga yig'ilishi kerak bo'lgan field'lar */
  profileCheck?: (p: SessionContext["recommendationProfile"]) => boolean;
}

// ============================================================
// A. TABIIY SO'ZLASHUV (55)
// ============================================================

const NATURAL_CASES: BlindCase[] = [
  { msg: "kelajakda vrach bo'lib ishlasam deb yuribman, lekin universitet masalasida umuman tushuncham yo'q", want: "Kasbiy maqsad (vrach) + tushunmovchilik → maslahat", intent: "recommendation", direction: "tibbiyot" },
  { msg: "IT yoqadi, lekin ota-onam iqtisod o'qishingni xohlashyapti", want: "Tanlov ziddiyati → maslahat", intent: "recommendation", direction: "it" },
  { msg: "20 mln bor, lekin grant chiqsa undan ham yaxshi", want: "Byudjet + shartli grant afzalligi → maslahat", intent: "recommendation", budget: 20000000, noCategory: true },
  { msg: "dasturchi bo'lishni xohlayman-u, lekin matematikam juda past", want: "Kasb + zaiflik → maslahat", intent: "recommendation", direction: "it" },
  { msg: "bolam shu yil maktabni bitiradi, qaysi universitetga topshiramiz deb o'ylayapmiz", want: "Ota-ona maslahat so'rayapti (maktab = pedagogika EMAS)", intent: "recommendation", noDirection: ["pedagogika"] },
  { msg: "aka ukam TATUda o'qiydi, menga ham shunga o'xshash biror narsa kerak", want: "TATU referens — o'xshashini so'rash → maslahat", intent: "recommendation" },
  { msg: "men uchun eng muhimi diplom bo'lsa bo'ldi, qayerda o'qishim farqi yo'q", want: "Diplom istagi (farqi yo'q = befarq) → comparison EMAS", intent: "recommendation", mustNotIntent: ["comparison"] },
  { msg: "ishlab turibman, kechki ta'lim bormi shu yerda", want: "Kechki ta'lim (ta'lim = pedagogika EMAS) → maslahat", intent: "recommendation", noDirection: ["pedagogika"] },
  { msg: "qizimga qaysi kasbni tanlashni bilmayapman, o'zi hech narsa demaydi", want: "Farzandiga kasb tanlashda yordam → maslahat", intent: "recommendation" },
  { msg: "ITdan boshqa narsa o'qigim kelmaydi, faqat shunga qarayman", want: "Aniq afzallik → maslahat", intent: "recommendation", direction: "it" },
  { msg: "meni faqat tibbiyot qiziqtiradi, boshqa hech narsa emas", want: "Aniq afzallik → maslahat", intent: "recommendation", direction: "tibbiyot" },
  { msg: "xorijda o'qishni xohlayman, lekin Toshkentdan chiqib ketolmayman", want: "Xorij istagi + shahar cheklovi → maslahat", intent: "recommendation" },
  { msg: "grant ololmadim, endi kontrakt to'lay olamanmi deb o'ylayapman", want: "Grant vaziyati + kontrakt savoli → maslahat", intent: "recommendation" },
  { msg: "bizda pul yo'q, davlat universiteti bo'lsa yaxshi edi", want: "Byudjet cheklovi + davlat istagi → maslahat", intent: "recommendation", category: "3" },
  { msg: "o'qishga kirish uchun nima qilishim kerak bilmayman, hamma narsa chalkash", want: "Qabul jarayoni haqida umumiy yordam", intent: "general_chat" },
  { msg: "tumanimizda qanday imkoniyatlar bor, bilishni istayman", want: "Hududdagi imkoniyatlar haqida umumiy savol", intent: "faq" },
  { msg: "qaysi yo'nalish ko'proq pul topdiradi", want: "Daromad bo'yicha yo'nalish → maslahat", intent: "recommendation" },
  { msg: "PDP haqida bir narsa eshitdim, rostmi o'sha", want: "PDP haqida ma'lumot", intent: "university_search", mustNotIntent: ["recommendation"] },
  { msg: "universitetlar ro'yxatini ko'rsatib yuboringchi", want: "Katalog", intent: "university_list" },
  { msg: "bolam maktabni endi bitirdi, o'zi hech qanday fikr bildirmayapti", want: "Farzand haqida bayon (so'rov yo'q) → faq", intent: "faq", noDirection: ["pedagogika"] },
  { msg: "men kechki o'qishni xohlayapman, ishdan bo'shashim yo'q", want: "Ish + o'qish kombinatsiyasi → maslahat", intent: "recommendation" },
  { msg: "uydan uzoq ketolmayman, shu yaqin orada biror narsa bormi", want: "Joylashuv cheklovi (noaniq so'rov) → faq", intent: "faq" },
  { msg: "oqsoch bolaman deydi, maktabda zo'r o'qigan", want: "Farzand kasbi haqida gap → maslahat", intent: "recommendation" },
  { msg: "meni asabiylashtirayotgan narsa shuki, hali tanlov qilmadim", want: "Tanlov qilmagan → maslahat", intent: "recommendation" },
  { msg: "hozircha faqat ma'lumot yig'yapman, xulosa chiqarmadim", want: "Ma'lumot yig'ish → katalog/faq", intent: "faq" },
  { msg: "aka singlim shu yil imtihon topshiradi, biz hech narsa bilmaymiz", want: "Oila imtihon jarayoni → maslahat", intent: "recommendation" },
  { msg: "menga uyda o'tirib o'qish mumkin bo'lgan narsa kerak", want: "Masofaviy ta'lim (noaniq) → direction", intent: "direction_search" },
  { msg: "yotoqxonasiz ilojim yo'q, qishloqdan kelaman", want: "Yotoqxona sharti (qishloq = agrar EMAS)", intent: "direction_search", noDirection: ["qishloq"] },
  { msg: "grantga umid qilmayman, o'zim to'layman", want: "Grant rad + o'z to'lovi → maslahat", intent: "recommendation" },
  { msg: "IT sohasida ishlayotganlar ko'p pul topadi deyishadi, rostmi", want: "IT sohasi haqida savol → yo'nalish", intent: "direction_search", direction: "it" },
  { msg: "kattakon bo'lgani uchun kechikdim, endi nima qilsam", want: "Yosh masalasi → maslahat", intent: "general_chat" },
  { msg: "biz tomonda universitet yo'q, qo'shni viloyatga borishim kerakmi", want: "Hudud tanlovi (noaniq) → faq", intent: "faq" },
  { msg: "o'g'lim tibbiyotni xohlaydi, lekin qizim dizayn deydi", want: "Ikki farzand tanlovi → tibbiyot yo'nalishi", intent: "direction_search", direction: "tibbiyot" },
  { msg: "shu yil bitirayapman, keyingi yilga tayyorlanishni boshladim", want: "Tayyorlanish (bayon) → faq", intent: "faq" },
  { msg: "bizning maktabda faqat bitta o'qituvchi dars beradi", want: "Maktab haqida gap (so'rov yo'q)", intent: "direction_search" },
  { msg: "men bu yil kira olmadim, ota-onam xafa bo'lishyapti, lekin men taslim bo'lmayman", want: "Yiqilgan + davom etish → maslahat", intent: "recommendation" },
  { msg: "qaysi kasbni tanlasam kelajagim uchun foydali", want: "Kasb tanlash → maslahat", intent: "recommendation" },
  { msg: "universitetda o'qish shartmi yoki kurslar yetarli", want: "O'qish vs kurslar (noaniq) → direction", intent: "direction_search" },
  { msg: "meni kompyuter bilan ishlash qiziqtiradi, lekin dasturlash emas", want: "IT ichida aniq emas → maslahat", intent: "recommendation", direction: "it" },
  { msg: "buxgalter bo'lish uchun nima o'qish kerak", want: "Kasbga yo'nalish → direction", intent: "direction_search", direction: "iqtisod" },
  { msg: "shu joyda qanday universitetlar bor ekan", want: "Katalog", intent: "university_list" },
  { msg: "qoraqalpoq tilida o'qiydigan bormi", want: "Til bo'yicha filter", intent: "university_search" },
  { msg: "kechqurunlari ishlayman, kunduzgi bo'lmasin", want: "Ta'lim shakli → katalog", intent: "university_search" },
  { msg: "men uchun eng muhimi amaliyot, nazariya emas", want: "Amaliyot ustuvor (bayon) → faq", intent: "faq" },
  { msg: "o'qishni boshlashdan oldin pul yig'ishim kerak", want: "Reja (bayon) → faq", intent: "faq" },
  { msg: "shahar markazida o'qishni xohlayman, chekkada emas", want: "Joylashuv → maslahat", intent: "recommendation" },
  { msg: "men ikki yo'nalishni ko'rib chiqyapman, qaysi birini olishni bilmayman", want: "Ikki yo'nalish tanlovi → maslahat", intent: "recommendation" },
  { msg: "ITni xohlayman, lekin qo'limdan kod yozish kelmaydimi deb qo'rqaman", want: "Qo'rquv + IT → maslahat", intent: "recommendation", direction: "it" },
  { msg: "ota-onamga ishonch bersam bo'ldi, ularni qo'llab-quvvatlashi kerak", want: "Oila bilan munosabat (bayon) → faq", intent: "faq" },
  { msg: "tibbiyotdan qolib, ITga o'tsam bo'ladimi", want: "Yo'nalish o'zgartirish → direction", intent: "direction_search", direction: "it" },
  { msg: "menda diplom bor, lekin qayta o'qishni xohlayman", want: "Qayta o'qish → maslahat", intent: "recommendation" },
  { msg: "ikki yil ishladim, endi o'qishni davom ettirmoqchiman", want: "Ishdan o'qishga → davom etish → maslahat", intent: "recommendation" },
  { msg: "maktab o'qituvchisi bo'lishni orzu qilaman", want: "Aniq kasb (o'qituvchi) → maslahat", intent: "recommendation", direction: "pedagogika" },
  { msg: "maktabgacha ta'lim yo'nalishi bormi", want: "Aniq pedagogika yo'nalishi → direction", intent: "direction_search", direction: "pedagogika" },
];

// ============================================================
// B. TYPO (35)
// ============================================================

const TYPO_CASES: BlindCase[] = [
  { msg: "hususiy universetlar qaysilar", want: "'hususiy' typo → xususiy kategoriya", intent: "university_search", category: "4" },
  { msg: "xusisiy bolsin", want: "'xusisiy' typo → xususiy", intent: "university_search", category: "4" },
  { msg: "davliniki yaxshimi", want: "'davliniki' typo → davlat", intent: "university_search", category: "3" },
  { msg: "kantrakt narxi qancha", want: "'kantrakt' typo → narx so'rovi", intent: "tuition_search" },
  { msg: "yotoqhonasi bormi", want: "'yotoqhonasi' typo → yotoqxona (kontekstsiz → aniqlashtirish)", intent: "faq" },
  { msg: "telefon nomeri bormi", want: "Telefon so'rovi (kontekstsiz → aniqlashtirish)", intent: "faq" },
  { msg: "unversitetga kirmoqchiman", want: "'unversitet' typo → maslahat", intent: "recommendation" },
  { msg: "tibiyotga qiziqaman", want: "'tibiyot' typo → tibbiyot", intent: "direction_search", direction: "tibbiyot" },
  { msg: "doktir bolmoqchiman", want: "'doktir' typo → tibbiyot", intent: "recommendation", direction: "tibbiyot" },
  { msg: "dasturchi bolishni hohlayman", want: "'hohlayman' typo → maslahat", intent: "recommendation", direction: "it" },
  { msg: "kompyutr injiniringi qayerda", want: "'kompyutr' typo → yo'nalish qidiruvi", intent: "direction_search", direction: "it" },
  { msg: "samarkandda it okish mumkinmi", want: "Typo + shahar + IT (mumkinmi → yo'nalish)", intent: "direction_search", direction: "it" },
  { msg: "toshkentda tibbiet kerak", want: "'tibbiet' typo → tibbiyot", intent: "direction_search", direction: "tibbiyot" },
  { msg: "iqtisodch bolmoqchiman", want: "'iqtisodch' typo → iqtisod", intent: "recommendation", direction: "iqtisod" },
  { msg: "men injener bolmoqchiman", want: "'injener' typo → muhandislik", intent: "recommendation" },
  { msg: "pedagogkaga qiziqaman", want: "'pedagogka' typo → pedagogika", intent: "direction_search", direction: "pedagogika" },
  { msg: "xalqaro universitei kerak", want: "'universitei' typo → xalqaro", intent: "university_search", category: "5" },
  { msg: "grantlar hakida ayt", want: "'hakida' typo → grant ma'lumoti", intent: "grant_search" },
  { msg: "budjetim 20m", want: "Qisqartma budget", intent: "university_search", budget: 20000000 },
  { msg: "15 mln dan oshmasin", want: "Budget cheklovi (bayon)", intent: "faq", budget: 15000000 },
  { msg: "eng ko'pi 25mln", want: "Budget max", intent: "university_search", budget: 25000000 },
  { msg: "kantrak 20 mln ichida bolsin", want: "Kontrakt budget", intent: "faq", budget: 20000000 },
  { msg: "oqishga kirmoqchiman lekin bilmayman qayerga", want: "Typo + noaniq → maslahat", intent: "recommendation" },
  { msg: "yonalish tanlashga yordam bering", want: "'yonalish' (apostrofsiz) → maslahat", intent: "recommendation" },
  { msg: "universitetlarha malumot bering", want: "'universitetlarha' typo → katalog", intent: "university_list" },
  { msg: "pdpda okish qancha", want: "PDP + narx", intent: "university_search" },
  { msg: "tatu kontrakti qancha", want: "TATU narxi", intent: "tuition_search" },
  { msg: "qanaqa fanlar okitiladi", want: "Typo → yo'nalishlar", intent: "direction_search" },
  { msg: "menga o'xshash uni kerak", want: "O'xshash tavsiya", intent: "recommendation" },
  { msg: "to'rtinchi variantga qara", want: "Navigatsiya (kontekstsiz → aniqlashtirish)", intent: "faq" },
  { msg: "yana bittasini kursat", want: "Navigatsiya", intent: "recommendation" },
  { msg: "eng arzoni qaysi", want: "Arzonini so'rash (kontekstsiz → aniqlashtirish)", intent: "faq" },
  { msg: "muhandislikka yaraymanmi", want: "Muhandislik mosligi", intent: "recommendation" },
  { msg: "turizm sohasi qanday", want: "Turizm yo'nalishi", intent: "direction_search" },
  { msg: "arxitektor bo'lishni istayman", want: "Arxitektura kasbi", intent: "recommendation" },
];

// ============================================================
// C. NEGATIV / QARAMA-QARSHILIK (40)
// ============================================================

const NEGATION_CASES: BlindCase[] = [
  { msg: "xususiy bo'lmasin, faqat davlat", want: "Negativ xususiy + davlat", intent: "university_search", category: "3" },
  { msg: "davlat bo'lmasin, xususiy kerak", want: "Negativ davlat + xususiy (bayon → suhbat)", intent: "faq", category: "4" },
  { msg: "xususiy ham davlat ham farqi yo'q", want: "Kategoriya befarq → filter yo'q", intent: "recommendation", noCategory: true },
  { msg: "faqat grant", want: "Faqat grant", intent: "grant_search" },
  { msg: "grant shart emas", want: "Negativ grant → suhbat", intent: "faq" },
  { msg: "grant kerak emas, kontrakt to'layman", want: "Negativ grant + kontrakt", intent: "recommendation" },
  { msg: "grant bo'lsa ham bo'ladi, bo'lmasa ham", want: "Grant befarq", intent: "recommendation" },
  { msg: "davlatni xohlayman, lekin kira olmasam xususiy ham bo'ladi", want: "Davlat primary + xususiy fallback", intent: "recommendation", category: "3" },
  { msg: "ITga qiziqaman, lekin xususiy bo'lmasin", want: "Qiziqish + negativ xususiy", intent: "recommendation", noCategory: true, direction: "it" },
  { msg: "tibbiyotga qiziqaman, lekin davlat bo'lmasin", want: "Qiziqish + negativ davlat", intent: "recommendation", noCategory: true, direction: "tibbiyot" },
  { msg: "TATU emas, boshqa birini ko'rsat", want: "TATU rad → boshqa", intent: "recommendation", mustNotIntent: ["university_search"] },
  { msg: "yo'q, PDP kerak emas", want: "PDP rad", intent: "faq" },
  { msg: "men xususiy istamayman", want: "Negativ xususiy (bayon → suhbat)", intent: "faq", noCategory: true },
  { msg: "davlat istamayman, xususiy bo'lsin", want: "Negativ davlat + xususiy (bayon → suhbat)", intent: "faq", category: "4" },
  { msg: "grant yutmoqchiman, lekin ballim yetmaydi", want: "Grant + yetishmovchilik → maslahat", intent: "recommendation" },
  { msg: "20 mln bor, lekin 30 mln ham bersam bo'ladi", want: "Budget egiluvchan → yuqori miqdor (bayon → suhbat)", intent: "faq", budget: 30000000 },
  { msg: "15 mln yetadi, oshirishga hojat yo'q", want: "Budget qat'iy (bayon → suhbat)", intent: "faq", budget: 15000000 },
  { msg: "Toshkentda yashayman, lekin Samarqandda o'qisam ham bo'ladi", want: "Ikki shahar (bayon → suhbat)", intent: "faq" },
  { msg: "faqat Toshkent, boshqa joy yo'q", want: "Qat'iy shahar (bayon → suhbat)", intent: "faq" },
  { msg: "Samarqandda o'qimoqchiman, Toshkent emas", want: "Shahar aniq", intent: "recommendation" },
  { msg: "grant olsam zo'r bo'lardi, olmasam ham mayli", want: "Shartli grant → maslahat", intent: "recommendation" },
  { msg: "pulim yetmaydi, arzonroq kerak", want: "Byudjet cheklovi → arzon", intent: "tuition_search" },
  { msg: "narxi muhim emas, sifat muhim", want: "Sifat ustuvor → maslahat", intent: "recommendation" },
  { msg: "yotoqxona bo'lmasa ham mayli, asosiysi o'qish", want: "Yotoqxona befarq → bayon (accommodation EMAS)", intent: "faq" },
  { msg: "ingliz tili shart emas, rus tilida ham bo'ladi", want: "Til befarq", intent: "university_search" },
  { msg: "bakalavr emas, magistr kerak", want: "Degree aniq", intent: "university_search" },
  { msg: "kunduzgi bo'lmasin, sirtqi qilaman", want: "Ta'lim shakli aniq (sirtqi → maslahat)", intent: "recommendation" },
  { msg: "masofaviy o'qishni xohlamayman", want: "Negativ masofaviy (masofaviy EMAS → maslahat)", intent: "recommendation" },
  { msg: "xorijga ketishni istamayman, shu yerda qolaman", want: "Mahalliy qolish → maslahat", intent: "recommendation" },
  { msg: "ITdan boshqa hech narsa yo'q", want: "Faqat IT", intent: "recommendation", direction: "it" },
  { msg: "tibbiyotdan boshqa o'qimayman", want: "Faqat tibbiyot", intent: "recommendation", direction: "tibbiyot" },
  { msg: "menga pul kerak emas, grant yetarli", want: "Grant afzallik → grant qidiruvi", intent: "grant_search" },
  { msg: "grant bo'lmasa, kontraktga rozi", want: "Grant + kontrakt fallback", intent: "recommendation" },
  { msg: "katta universitet bo'lmasin, kichikroq bo'lsa yaxshi", want: "Hajm afzallik (bayon → suhbat)", intent: "faq" },
  { msg: "eski universitet kerak, tajribali bo'lsin", want: "Tajriba afzallik", intent: "recommendation" },
  { msg: "yangi ochilgan universitetga ishonmayman", want: "Ishonch → fikr bayoni", intent: "faq" },
  { msg: "men davlatga kira olmadim, lekin yana davlatni xohlayman", want: "Yiqilgan + explicit davlat → davlat ustun", intent: "recommendation", category: "3" },
  { msg: "kirolmadim, endi xususiyga o'taman", want: "Yiqilgan → xususiy yo'l", intent: "recommendation", category: "4" },
  { msg: "birinchi yil qoldim, qayta topshiraman", want: "Qayta topshirish → maslahat", intent: "recommendation" },
  { msg: "uydan chiqib ketolmayman, lekin o'qishni istayman", want: "Masofaviy imkoniyat", intent: "recommendation" },
];

// ============================================================
// D. NOANIQ / AMBIGUOUS (35)
// ============================================================

const AMBIGUOUS_CASES: BlindCase[] = [
  { msg: "boshqa", want: "Kontekstsiz → unknown (clarification)", intent: "unknown" },
  { msg: "o'sha", want: "Kontekstsiz → unknown (clarification)", intent: "unknown" },
  { msg: "yana bitta", want: "Kontekstsiz → unknown (clarification)", intent: "unknown" },
  { msg: "nimadir kerak edi", want: "Noaniq", intent: "faq" },
  { msg: "universitetlar haqida", want: "Umumiy katalog", intent: "university_list" },
  { msg: "yo'nalishlar haqida", want: "Umumiy yo'nalishlar", intent: "direction_search" },
  { msg: "yordam bering", want: "Umumiy yordam", intent: "faq" },
  { msg: "maslahat bering", want: "Umumiy maslahat → suhbat", intent: "general_chat" },
  { msg: "nima qilsam yaxshi", want: "Umumiy maslahat", intent: "general_chat" },
  { msg: "bilmayman, o'zingiz hal qiling", want: "Hal qilishni so'rash", intent: "faq" },
  { msg: "qanday bo'ladi", want: "Kontekstsiz", intent: "faq" },
  { msg: "u nimani anglatadi", want: "Tushuntirish so'rovi", intent: "faq" },
  { msg: "mana shu haqida", want: "Kontekstsiz ko'rsatish", intent: "faq" },
  { msg: "bittasini tanlang", want: "Tanlashni so'rash", intent: "recommendation" },
  { msg: "qaysi birini olsam", want: "Tanlov → maslahat", intent: "recommendation" },
  { msg: "eng yaxshisi qaysi", want: "Eng yaxshisi → maslahat", intent: "recommendation" },
  { msg: "sizningcha-chi", want: "Fikr so'rash", intent: "faq" },
  { msg: "rostdan ham shundaymi", want: "Tasdiq so'rovi", intent: "faq" },
  { msg: "yaxshi eshitilmayapti", want: "Shubha", intent: "faq" },
  { msg: "boshqa narsani ko'rsating", want: "Boshqa variant", intent: "recommendation" },
  { msg: "men shu haqida o'ylab ko'raman", want: "O'ylash → suhbat", intent: "faq" },
  { msg: "hozircha yetarli", want: "Tugatish", intent: "faq" },
  { msg: "rahmat, keyinroq yozaman", want: "Xayrlashish", intent: "thanks" },
  { msg: "xayr", want: "Xayrlashish", intent: "greeting" },
  { msg: "nima yangiliklar", want: "Yangiliklar", intent: "news_search" },
  { msg: "grantlar qachon boshlanadi", want: "Grant vaqtlari", intent: "grant_search" },
  { msg: "hujjat topshirish muddati", want: "Deadline → qabul", intent: "admission" },
  { msg: "qabul qachon boshlanadi", want: "Qabul vaqti", intent: "admission" },
  { msg: "kirish ballari qanday", want: "Ballar haqida", intent: "admission" },
  { msg: "talabalar soni qancha", want: "Talabalar soni (kontekstsiz → aniqlashtirish)", intent: "faq" },
  { msg: "ustozlari qanday", want: "Professorlar (kontekstsiz → aniqlashtirish)", intent: "faq" },
  { msg: "kampus qayerda", want: "Manzil (kontekstsiz → aniqlashtirish)", intent: "faq" },
  { msg: "darslar qanday o'tadi", want: "Ta'lim jarayoni (kontekstsiz → aniqlashtirish)", intent: "faq" },
  { msg: "imtihonlar og'irmi", want: "Imtihon murakkabligi (kontekstsiz → aniqlashtirish)", intent: "faq" },
  { msg: "o'qishni tashlab ketsam bo'ladimi", want: "Tashlab ketish → suhbat", intent: "faq" },
];

// ============================================================
// E. RECOMMENDATION KOMBINATSIYALARI (50)
// ============================================================

const RECOMMEND_CASES: BlindCase[] = [
  { msg: "IT, Toshkent, 20 mln, menga variant topib ber", want: "To'liq profil → maslahat", intent: "recommendation", direction: "it", budget: 20000000 },
  { msg: "tibbiyot, Toshkent, yotoqxona kerak", want: "Tibbiyot + yotoqxona", intent: "recommendation", direction: "tibbiyot" },
  { msg: "iqtisod, Samarqand, xususiy", want: "Iqtisod + shahar + xususiy", intent: "recommendation", direction: "iqtisod", category: "4" },
  { msg: "IT, davlat, Toshkent", want: "IT + davlat + Toshkent", intent: "recommendation", direction: "it", category: "3" },
  { msg: "IT, grant kerak, ingliz tili", want: "IT + grant + til → grant qidiruvi", intent: "grant_search", direction: "it" },
  { msg: "20 mln, xususiy, IT", want: "Budget + xususiy + IT", intent: "recommendation", direction: "it", category: "4", budget: 20000000 },
  { msg: "IT, 25 mln gacha, yotoqxona bo'lsa yaxshi", want: "IT + budget + yotoqxona", intent: "recommendation", direction: "it", budget: 25000000 },
  { msg: "tibbiyot, 15 mln, Toshkent", want: "Tibbiyot + budget + shahar", intent: "recommendation", direction: "tibbiyot", budget: 15000000 },
  { msg: "IT, xalqaro, Toshkent", want: "IT + xalqaro", intent: "recommendation", direction: "it", category: "5" },
  { msg: "IT, 20 mln, grant bo'lsa zo'r", want: "IT + budget + grant", intent: "recommendation", direction: "it", budget: 20000000 },
  { msg: "menga IT bo'yicha eng yaxshi 5 ta univ top", want: "Top-5 tavsiya", intent: "recommendation", direction: "it" },
  { msg: "qaysi univda IT o'qisam yaxshi", want: "IT tanlov → maslahat", intent: "recommendation", direction: "it" },
  { msg: "Toshkentda tibbiyot bo'yicha tavsiya ber", want: "Tibbiyot tavsiya", intent: "recommendation", direction: "tibbiyot" },
  { msg: "men bankda ishlamoqchiman, qaysi yo'nalish", want: "Kasb → yo'nalish", intent: "recommendation" },
  { msg: "doktor bo'lish uchun qayerda o'qish kerak", want: "Kasb → maslahat", intent: "recommendation", direction: "tibbiyot" },
  { msg: "o'qituvchi bo'lishni xohlayman", want: "Kasb (o'qituvchi)", intent: "recommendation", direction: "pedagogika" },
  { msg: "ITda o'qib, xorijda ishlamoqchiman", want: "Kasb + xorij → maslahat", intent: "recommendation", direction: "it" },
  { msg: "buxgalteriya qayerda o'qitiladi", want: "Yo'nalish qidiruvi", intent: "direction_search" },
  { msg: "dasturlash bo'yicha grant bormi", want: "Grant + yo'nalish", intent: "grant_search" },
  { msg: "IT yo'nalishlari bo'lgan xususiy univlar", want: "Katalog filter", intent: "direction_search", direction: "it" },
  { msg: "Toshkentdagi davlat univlarda IT bormi", want: "Shahar + davlat + IT", intent: "direction_search", direction: "it" },
  { msg: "Samarqandda tibbiyot bor universitetlar", want: "Shahar + tibbiyot", intent: "direction_search", direction: "tibbiyot" },
  { msg: "20 mln ichida IT yo'nalishi bor univlar", want: "Budget + IT katalog", intent: "direction_search", direction: "it", budget: 20000000 },
  { msg: "eng arzon IT univlari", want: "Arzon IT", intent: "tuition_search" },
  { msg: "grant beradigan IT univlar", want: "Grant + IT katalog", intent: "grant_search" },
  { msg: "kechki IT o'qish mumkinmi", want: "Kechki IT", intent: "recommendation", direction: "it" },
  { msg: "sirtqi tibbiyot bormi", want: "Sirtqi tibbiyot", intent: "recommendation", direction: "tibbiyot" },
  { msg: "masofaviy IT kursi universitetdami", want: "Masofaviy IT", intent: "recommendation", direction: "it" },
  { msg: "ingliz tilida IT o'qitadiganlar", want: "Til + IT → yo'nalish", intent: "direction_search", direction: "it" },
  { msg: "B2 bo'lsam ITga kiramanmi", want: "Til darajasi + IT → yo'nalish", intent: "direction_search", direction: "it" },
  { msg: "matematikam zaif, IT o'qisam bo'ladimi", want: "Zaiflik + IT → maslahat", intent: "recommendation", direction: "it" },
  { msg: "C1 darajam bor, xalqaro univ tavsiya qil", want: "Til + xalqaro", intent: "recommendation", category: "5" },
  { msg: "men bu yil yiqildim, ITda o'qimoqchiman", want: "Yiqilgan + IT → private-first", intent: "recommendation", direction: "it" },
  { msg: "yiqildim, tibbiyot, Toshkent", want: "Yiqilgan + tibbiyot", intent: "recommendation", direction: "tibbiyot" },
  { msg: "ballim yetmadi, xususiy bormi", want: "Yiqilgan + xususiy", intent: "recommendation", category: "4" },
  { msg: "davlatga kira olmadim, nima qilsam", want: "Yiqilgan → maslahat", intent: "recommendation" },
  { msg: "grantga kira olmadim, kontrakt asosida o'qisam bo'ladimi", want: "Grant yo'q → kontrakt", intent: "recommendation" },
  { msg: "TATUga ballim yetmadi, boshqa variant", want: "Ball yetmadi → boshqa", intent: "recommendation" },
  { msg: "bu yil kirishni xohlamayman, keyingi yil", want: "Kechiktirish → suhbat", intent: "faq" },
  { msg: "o'tgan yili ham kira olmadim", want: "Tarix → suhbat (empatiya)", intent: "general_chat" },
  { msg: "ikki marta yiqildim, yana urinishga arziydimi", want: "Qayta urinish → suhbat", intent: "general_chat" },
  { msg: "men uchun eng yaxshi variantni tanla", want: "Profil asosida tanlov", intent: "recommendation" },
  { msg: "menga mos keladiganini ayt", want: "Mos variant → maslahat", intent: "recommendation" },
  { msg: "qaysi univ menga ko'proq mos", want: "Moslik → maslahat", intent: "recommendation" },
  { msg: "solishtirib bering, qaysi biri yaxshi", want: "Taqqoslash → maslahat", intent: "comparison" },
  { msg: "TAFU yaxshimi yoki TATU", want: "Ikki univ taqqoslash", intent: "comparison" },
  { msg: "PDP va WIUTni solishtir", want: "Taqqoslash", intent: "comparison" },
  { msg: "qaysi biri arzonroq, TATU yoki TUIT", want: "Narx taqqoslash", intent: "comparison" },
  { msg: "ITda o'qish uchun qaysi univni maslahat berasan", want: "IT tavsiya", intent: "recommendation", direction: "it" },
  { msg: "xotinim ham o'qimoqchi, unga ham topib ber", want: "Ikkinchi shaxs → maslahat", intent: "recommendation" },
];

// ============================================================
// F. MULTI-TURN ZANJIRLAR (7 × 5 = 35 tekshiruv)
// ============================================================

const TURN_CHAINS: TurnChain[] = [
  {
    turns: [
      "men bu yil imtihondan yiqildim",
      "lekin o'qishni juda xohlayman",
      "ITga qiziqaman",
      "Toshkentda yashayman",
      "qaysi universitetni tavsiya qilasan",
    ],
    want: "Profil bosqichma-bosqich yig'iladi → yakuniy maslahat",
    finalIntent: "recommendation",
    profileCheck: (p) => p.admissionFailed === true && Array.isArray(p.interests) && p.interests.includes("it") && p.city === "toshkent",
  },
  {
    turns: [
      "men doktor bo'lishni xohlayman",
      "Toshkentda yashayman",
      "bu yil kira olmadim",
      "nima qilishim mumkin",
    ],
    want: "Kasb + shahar + yiqilish → maslahat",
    finalIntent: "recommendation",
    profileCheck: (p) => p.admissionFailed === true,
  },
  {
    turns: [
      "TATU haqida ayt",
      "kontrakti qancha",
      "yotoqxonasi bormi",
      "telefoni bormi",
      "sayti qanday",
    ],
    // Bu harness universitеt kontekstini (lastUniversity) kuzatmaydi — oxirgi
    // turn ("sayti qanday") kontekstsiz field so'rovi → aniqlashtirish.
    // TATUga bog'lanish asosiy regression'da (augmentFollowUp bilan) tekshiriladi.
    want: "TATU konteksti 5 follow-up davomida buzilmasligi kerak (asosiy regression'da)",
    finalIntent: "faq",
  },
  {
    turns: [
      "TATU haqida ayt",
      "yo'q, EMUni nazarda tutdim",
      "kontrakti qancha",
      "yotoqxonasi bormi",
    ],
    // Bu harness universitеt kontekstini (lastUniversity) kuzatmaydi — oxirgi
    // turn kontekstsiz field so'rovi → aniqlashtirish. EMUga bog'lanish asosiy
    // regression'da (augmentFollowUp bilan) tekshiriladi.
    want: "Repair: TATU → EMU, keyingi savollar EMUga bog'lanadi (asosiy regression'da)",
    finalIntent: "faq",
  },
  {
    turns: [
      "Toshkentda IT univ tavsiya qil",
      "ikkinchisi haqida ayt",
      "kontrakti qancha",
      "telefoni bormi",
    ],
    // Bu harness lastRecommendations (navigatsiya) kontekstini kuzatmaydi —
    // oxirgi turn kontekstsiz → aniqlashtirish. Navigatsiya asosiy
    // regression'da (augmentFollowUp bilan) tekshiriladi.
    want: "Tavsiyalar navigatsiyasi: ikkinchi univ konteksti (asosiy regression'da)",
    finalIntent: "faq",
  },
  {
    turns: [
      "men bu yil kira olmadim",
      "tibbiyotga qiziqaman",
      "Toshkentda o'qimoqchiman",
      "menga variant top",
    ],
    want: "Yiqilgan + tibbiyot + shahar → private-first maslahat",
    finalIntent: "recommendation",
    profileCheck: (p) => p.admissionFailed === true && Array.isArray(p.interests) && p.interests.includes("tibbiyot"),
  },
  {
    turns: [
      "Toshkentda yashayman",
      "ITga qiziqaman",
      "budjetim 20 mln",
      "yotoqxona ham kerak",
      "grant bo'lsa yaxshi",
      "univ tavsiya qil",
    ],
    want: "5 ta preference yig'iladi → yakuniy maslahat",
    finalIntent: "recommendation",
    profileCheck: (p) => p.budget === 20000000 && p.interestGrant === true,
  },
  {
    turns: [
      "men bu yil imtihondan yiqildim",
      "lekin o'qishni xohlayman",
      "ITga qiziqaman",
      "Toshkentda yashayman",
      "budjetim 20 mln",
      "aslida IT emas, tibbiyotga qiziqaman",
      "yotoqxona ham kerak",
      "tavsiya qil",
    ],
    want: "8 turn: fikr o'zgarishi (IT→tibbiyot) — profil YANGILANADI, yakuniy maslahat",
    finalIntent: "recommendation",
    profileCheck: (p) =>
      p.admissionFailed === true &&
      Array.isArray(p.interests) &&
      p.interests.includes("tibbiyot") &&
      !p.interests.includes("it") &&
      p.city === "toshkent" &&
      p.budget === 20000000,
  },
  {
    turns: [
      "men davlat universitetini xohlayman",
      "lekin bu yil kira olmadim",
      "xususiy ham bo'lishi mumkin",
      "aslida faqat davlat kerak",
      "Toshkentda o'qimoqchiman",
      "grant bo'lsa yaxshi",
      "qaysi univni tavsiya qilasan",
    ],
    want: "7 turn: kategoriya bekor/qayta — explicit davlat ustun, yakuniy maslahat",
    finalIntent: "recommendation",
    profileCheck: (p) => p.admissionFailed === true && p.city === "toshkent" && p.interestGrant === true,
  },
];

// ============================================================
// H. ADVERSARIAL / FIKR O'ZGARISHI (STAGE 19) — ataylab chalkashtirish
// ============================================================

const ADVERSARIAL_CASES: BlindCase[] = [
  {
    msg: "20 mln budjetim bor, lekin 50 mln bo'lsa ham yaxshi universitet bo'lsa ayt",
    want: "Budget egiluvchan → yuqori miqdor (50m) + variant so'rovi",
    intent: "recommendation",
    budget: 50000000,
  },
  {
    msg: "Men davlatni xohlamayman, lekin TATU haqida ham aytib o't",
    want: "Davlat RAD (kategoriya yo'q), TATU mention saqlanadi → univ haqida",
    intent: "university_search",
    noCategory: true,
  },
  {
    msg: "IT emas, aslida iqtisodga qiziqaman, oldingi gapimni unut",
    want: "Direction o'zgarishi: IT EMAS, iqtisod → maslahat",
    intent: "recommendation",
    direction: "iqtisod",
  },
  {
    msg: "Toshkentda yashayman, Samarqandda o'qimoqchiman, lekin Toshkentdagi universitetlarni ham ko'rsat",
    want: "Ikki shahar (yashash + o'qish) → maslahat",
    intent: "recommendation",
  },
  {
    msg: "Grant kerak emas... aslida grant bo'lsa yaxshi",
    want: "Fikr o'zgarishi: negativ → ijobiy grant ustun → maslahat",
    intent: "recommendation",
  },
  {
    msg: "ITga qiziqaman, lekin tibbiyot ham yoqadi",
    want: "Ikki yo'nalish tanlovi → maslahat",
    intent: "recommendation",
  },
  {
    msg: "Toshkentda yashayman, Samarqandda o'qisam ham bo'ladi",
    want: "Ikkala shahar ham mumkin (bayon → suhbat)",
    intent: "faq",
  },
  {
    msg: "Xususiy bo'lmasin, lekin TATU kabi kuchlisi bo'lsa ko'raman",
    want: "Xususiy RAD (kategoriya yo'q), sifat sharti → maslahat",
    intent: "recommendation",
    noCategory: true,
  },
];

// ============================================================
// G. COMPARISON / DETAIL / NAVIGATION (30)
// ============================================================

const DETAIL_CASES: BlindCase[] = [
  { msg: "TATU yaxshimi yoki INHAmi", want: "Ikki univ taqqoslash", intent: "comparison" },
  { msg: "TATU va TUIT ning farqi nima", want: "Farq so'rovi", intent: "comparison" },
  { msg: "PDP yoki MDIS qaysi biri yaxshi", want: "Ikki univ taqqoslash", intent: "comparison" },
  { msg: "Amity vs Westminster", want: "Taqqoslash", intent: "comparison" },
  { msg: "davlatmi yoki xususiy yaxshiroq", want: "Kategoriya taqqoslash", intent: "comparison" },
  { msg: "TATU haqida batafsil ayt", want: "Univ detali", intent: "university_detail" },
  { msg: "PDP telefoni qancha", want: "PDP telefon", intent: "university_search" },
  { msg: "PDP kontrakti qancha", want: "PDP narx", intent: "tuition_search" },
  { msg: "PDP yotoqxonasi bormi", want: "PDP yotoqxona", intent: "university_search" },
  { msg: "PDP granti bormi", want: "PDP grant", intent: "university_search" },
  { msg: "PDP qabul qilayaptimi", want: "PDP qabul", intent: "admission" },
  { msg: "PDP sayti bormi", want: "PDP sayt", intent: "university_search" },
  { msg: "PDP emaili nima", want: "PDP email", intent: "university_search" },
  { msg: "PDP manzili qayerda", want: "PDP manzil", intent: "university_search" },
  { msg: "PDPda nechta yo'nalish bor", want: "PDP yo'nalishlar", intent: "direction_search" },
  { msg: "kontrakti qancha", want: "Kontekstsiz narx → clarification", intent: "tuition_search" },
  { msg: "telefoni nima", want: "Kontekstsiz telefon → aniqlashtirish", intent: "faq" },
  { msg: "yotoqxonasi bormi", want: "Kontekstsiz yotoqxona → aniqlashtirish", intent: "faq" },
  { msg: "granti bormi", want: "Kontekstsiz grant", intent: "grant_search" },
  { msg: "sayti bormi", want: "Kontekstsiz sayt → aniqlashtirish", intent: "faq" },
  { msg: "TATUda IT yo'nalishlari bormi", want: "Univ + yo'nalish", intent: "direction_search", direction: "it" },
  { msg: "PDPda tibbiyot bormi", want: "Univ + yo'nalish", intent: "direction_search", direction: "tibbiyot" },
  { msg: "TATUga qabul qanday", want: "TATU qabul", intent: "admission" },
  { msg: "TATU granti bormi", want: "TATU grant", intent: "university_search" },
  { msg: "TATU yotoqxonasi bormi", want: "TATU yotoqxona", intent: "university_search" },
  { msg: "TATU kontrakti qancha", want: "TATU narx", intent: "tuition_search" },
  { msg: "TATU telefoni bormi", want: "TATU telefon", intent: "university_search" },
  { msg: "TATU manzili qayerda", want: "TATU manzil", intent: "university_search" },
  { msg: "TATU reytingi qanday", want: "TATU reyting", intent: "university_search" },
  { msg: "TATU bitiruvchilari qayerda ishlaydi", want: "TATU bitiruvchilar", intent: "university_search" },
];

// ============================================================
// RUNNER
// ============================================================

let pass = 0;
let fail = 0;

function checkIntent(c: BlindCase, label: string): void {
  const intent = intentClassifier.classify(c.msg);
  const overridden = isSituationalRecommendation(c.msg, intent, undefined);
  const finalIntent = overridden ? "recommendation" : intent.intent;
  const checks: Array<[string, boolean]> = [];
  if (c.intent) checks.push([`intent=${c.intent}`, finalIntent === c.intent]);
  if (c.mustNotIntent) {
    for (const ni of c.mustNotIntent) {
      checks.push([`intent ${ni} EMAS`, finalIntent !== ni]);
    }
  }
  if (c.noDirection) {
    for (const d of c.noDirection) {
      checks.push([`direction ${d} EMAS`, intent.entities?.direction !== d]);
    }
  }
  if (c.direction) checks.push([`direction=${c.direction}`, intent.entities?.direction === c.direction]);
  if (c.noCategory) checks.push(["kategoriya yo'q", !intent.entities?.institutionCategory && !intent.entities?.institutionCategories]);
  if (c.category) checks.push([`kategoriya=${c.category}`, String(intent.entities?.institutionCategory) === c.category]);
  if (c.budget) checks.push([`budget=${c.budget}`, intent.entities?.tuitionMax === c.budget]);
  const ok = checks.every(([, v]) => v);
  const mark = ok ? "✅" : "❌";
  console.log(`${mark} "${c.msg.slice(0, 64)}"`);
  if (!ok) {
    console.log(`   istagi: ${c.want}`);
    console.log(`   final=${finalIntent} entities=${JSON.stringify(intent.entities)}`);
    for (const [name, v] of checks) console.log(`   ${v ? "✅" : "❌"} ${name}`);
  }
  if (ok) pass++;
  else fail++;
}

function runCases(cases: BlindCase[], label: string): void {
  console.log("");
  console.log("=".repeat(60));
  console.log(label);
  console.log("=".repeat(60));
  for (const c of cases) checkIntent(c, label);
}

function runChains(): void {
  console.log("");
  console.log("=".repeat(60));
  console.log("F. MULTI-TURN ZANJIRLAR");
  console.log("=".repeat(60));
  for (const chain of TURN_CHAINS) {
    let profile: NonNullable<SessionContext["recommendationProfile"]> = {};
    let lastIntent = "";
    for (const turn of chain.turns) {
      const intent = intentClassifier.classify(turn);
      // SessionContext'ning to'g'ri shakli: { recommendationProfile } (profilni
      // o'zi emas). Aks holda profile-aware qarorlar (GUARD 1.5) ishlamaydi.
      const overridden = isSituationalRecommendation(turn, intent, { recommendationProfile: profile } as any);
      lastIntent = overridden ? "recommendation" : intent.intent;
      profile = updateRecommendationProfile(profile, turn, intent.entities);
    }
    const checks: Array<[string, boolean]> = [
      [`yakuniy intent=${chain.finalIntent}`, lastIntent === chain.finalIntent],
    ];
    if (chain.profileCheck) checks.push(["profil to'g'ri yig'ildi", chain.profileCheck(profile)]);
    const ok = checks.every(([, v]) => v);
    const mark = ok ? "✅" : "❌";
    console.log(`${mark} ${chain.turns[0].slice(0, 40)}... (${chain.turns.length} turn)`);
    if (!ok) {
      console.log(`   istagi: ${chain.want}`);
      console.log(`   oxirgi intent=${lastIntent} profil=${JSON.stringify(profile)}`);
      for (const [name, v] of checks) console.log(`   ${v ? "✅" : "❌"} ${name}`);
    }
    if (ok) pass++;
    else fail++;
  }
}

runCases(NATURAL_CASES, "A. TABIIY SO'ZLASHUV (55)");
runCases(TYPO_CASES, "B. TYPO (35)");
runCases(NEGATION_CASES, "C. NEGATIV / QARAMA-QARSHILIK (40)");
runCases(AMBIGUOUS_CASES, "D. NOANIQ / AMBIGUOUS (35)");
runCases(RECOMMEND_CASES, "E. RECOMMENDATION KOMBINATSIYALARI (50)");
runChains();
runCases(DETAIL_CASES, "G. COMPARISON / DETAIL / NAVIGATION (30)");
runCases(ADVERSARIAL_CASES, "H. ADVERSARIAL / FIKR O'ZGARISHI (8)");

console.log("");
console.log("=".repeat(60));
console.log(`BLIND NATIJA: ${pass} o'tdi, ${fail} muvaffaqiyatsiz`);
console.log("=".repeat(60));

// ============================================================
// LIVE MODE (--live): har bir test REAL API orqali agentning haqiqiy
// javobini ko'rsatadi (LLM bilan). Server localhost:3000 da ishlashi kerak.
//   npx tsx scripts/blind-tests.ts --live
//   CHAT_API_URL=http://localhost:3000/api/v1/chat AUTH_TOKEN="<token>" npx tsx scripts/blind-tests.ts --live
//
// Eslatma: ichki loglar ([RuleFallback], [StrongRecOverride]...) SERVER
// konsolida chiqadi — server terminalida ko'rinadi. Bu yerda API'dan kelgan
// intent/tool/selectedTool va to'liq javob matni ko'rsatiladi.
// ============================================================
const LIVE = process.argv.includes("--live");
const API_URL = process.env.CHAT_API_URL || "http://localhost:3000/api/v1/chat";
const AUTH_TOKEN = process.env.AUTH_TOKEN || "";
const GUEST_ID = `blind-live-${Date.now()}`;
// Ixtiyoriy diapazon: "--live 1-60" → faqat 1..60-chi case'lar. LLM javoblari
// sekin (~10s/har biri), shuning uchun qism-qism ishga tushirish mumkin.
let liveFrom = 1;
let liveTo = Infinity;
const rangeArg = process.argv.find((a) => /^\d+\s*-\s*\d+$/.test(a));
if (rangeArg) {
  const [f, t] = rangeArg.split("-").map((n) => parseInt(n, 10));
  liveFrom = f;
  liveTo = t;
}

interface LiveReply {
  text: string;
  intent: string;
  tool: string;
  sessionId?: string;
}

async function liveSend(message: string, sessionId?: string): Promise<LiveReply> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Guest-Id": GUEST_ID,
  };
  if (AUTH_TOKEN) headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
  const body: any = { message, language: "uz" };
  if (sessionId) body.sessionId = sessionId;
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { text: json?.error || `HTTP ${res.status}`, intent: "?", tool: "?" };
    }
    return {
      text: json?.data?.message || "",
      intent: json?.data?.intent || "?",
      tool: json?.data?.selectedTool || "?",
      sessionId: json?.data?.sessionId,
    };
  } catch (e: any) {
    return { text: `NETWORK: ${e?.message}`, intent: "?", tool: "?" };
  }
}

async function liveOne(c: BlindCase, expectedIntent?: string): Promise<void> {
  const r = await liveSend(c.msg);
  const match = expectedIntent && r.intent !== "?" ? (r.intent === expectedIntent ? "✅" : "❌") : "";
  console.log("");
  console.log(`📨 "${c.msg.slice(0, 70)}" ${match ? match + " intent=" + expectedIntent : ""}`);
  console.log(`   [server] intent=${r.intent}  tool=${r.tool}`);
  console.log(`   💬 ${r.text.replace(/\n+/g, " ").slice(0, 350)}`);
}

async function runLive(): Promise<void> {
  console.log("");
  console.log("#".repeat(60));
  console.log("LIVE — REAL AGENT JAVOBLARI (LLM)");
  console.log("#".repeat(60));
  console.log(`API: ${API_URL}  |  auth: ${AUTH_TOKEN ? "Bearer token" : "guest"}`);
  console.log("Ichki loglar ([RuleFallback] va h.k.) server konsolida chiqadi.");

  const all: Array<{ c: BlindCase; want?: string }> = [
    ...NATURAL_CASES.map((c) => ({ c })),
    ...TYPO_CASES.map((c) => ({ c })),
    ...NEGATION_CASES.map((c) => ({ c })),
    ...AMBIGUOUS_CASES.map((c) => ({ c })),
    ...RECOMMEND_CASES.map((c) => ({ c })),
    ...DETAIL_CASES.map((c) => ({ c })),
    ...ADVERSARIAL_CASES.map((c) => ({ c })),
  ];
  let i = 0;
  for (const { c } of all) {
    i++;
    if (i < liveFrom || i > liveTo) continue;
    console.log(`\n--- [${i}/${all.length}] ---`);
    await liveOne(c, c.intent);
  }

  console.log("");
  console.log("=".repeat(60));
  console.log("LIVE MULTI-TURN ZANJIRLAR");
  console.log("=".repeat(60));
  let ci = 0;
  for (const chain of TURN_CHAINS) {
    ci++;
    console.log(`\n--- ZANJIR ${ci}/${TURN_CHAINS.length}: ${chain.turns[0].slice(0, 40)}... ---`);
    let sessionId: string | undefined;
    for (const turn of chain.turns) {
      const r = await liveSend(turn, sessionId);
      sessionId = r.sessionId;
      console.log(`\n   👤 ${turn}`);
      console.log(`   [server] intent=${r.intent} tool=${r.tool}`);
      console.log(`   💬 ${r.text.replace(/\n+/g, " ").slice(0, 300)}`);
    }
  }
}

if (LIVE) {
  runLive().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
} else {
  process.exit(fail > 0 ? 1 : 0);
}
