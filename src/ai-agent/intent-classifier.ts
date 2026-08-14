import type { Intent, IntentResult } from "@/types";
import { detectDirectionCategory, detectDirectionWithConfidence, hasInterestPhrase, isAiBiomedicalContext } from "./direction-synonyms";
import {
  extractBudget,
  extractFaculty,
  extractDeadline,
  extractNewsCategory,
  extractStipend,
  extractCareerGoal,
  extractEnglishLevel,
  extractPreferredCities,
  extractUserGoalFlags,
} from "./entity-extractor";
import { compileAllIntentPatterns, getIntentPriority } from "./intent-config";
import { normalizeUserText } from "./text-normalizer";

export class IntentClassifier {
  // BOSQICH 4 (JSON-driven config): pattern'lar intent-config.json dan keladi.
  // Yangi intent qo'shish / mavjudini o'zgartirish uchun kod emas — JSON yangilanadi.
  // Kalit tartibi = klassifikatsiya tartibi (aniqroq intent'lar oldinda turishi kerak).
  private patterns: Record<string, RegExp[]> = compileAllIntentPatterns();

  classify(message: string): IntentResult {
    const cleanMessage = normalizeUserText(message);

    // ===== Step 0: GREETING GUARD =====
    // MUHIM: Faqat AYNAN salomlashish so'zi bo'lsa greeting (xabar shu bilan tugaydi).
    // "Assalomu alaykum, men Buxoro viloyatidanman..." → GREETING EMAS (uzun gap)!
    // Agar xabar 20 belgidan uzun yoki 3+ so'zdan iborat bo'lsa → recommendation/boshqa intent.
    const trimmed = cleanMessage.trim();
    const wordCount0 = trimmed.split(/\s+/).length;
    const isBareSalutation = /^(salom|assalomu\s*alaykum|hayrli\s*kun|hello|hi|hey|vaalom|good\s+(?:morning|evening|afternoon))\s*[!.?,]*\s*$/i.test(trimmed);
    if (isBareSalutation) {
      return {
        intent: "greeting" as Intent,
        confidence: 0.95,
        entityConfidence: {},
        entities: {},
      };
    }
    // Xabar salomlashish bilan BOSHLANSA lekin uzun bo'lsa → recommendation'ga o'tamiz
    // ("Assalomu alaykum, men ITga qiziqaman..." → recommendation)
    const startsWithGreeting = /^(salom|assalomu\s*alaykum|hayrli\s*kun|hello|hi|hey|vaalom)\b/i.test(trimmed);
    const isLongMessage = trimmed.length > 20 || wordCount0 > 3;
    // Salomlashish + uzun gap → oldindan recommendation markerini eslatib o'tamiz
    // (Step 1 patternlar ishlaydi, lekin greeting override ISHLAMAYDI)
    const greetingLedLong = startsWithGreeting && isLongMessage;

    // ===== TUZATISH #2/#3: entity'larni FAQAT BIR MARTA hisoblaymiz =====
    // Ilgari this.extractEntities(cleanMessage) va detectDirectionCategory(cleanMessage)
    // classify() davomida 6-7 marta qayta-qayta chaqirilardi (extractEntities ichida
    // ham detectDirectionCategory chaqiriladi — demak u alohida ham, ichkarida ham
    // ishlab, ikki baravar ortiqcha ishlagan). Bu performance yo'qotgan VA nazariy
    // jihatdan xavfli edi — agar extractEntities ichidagi mantiq keyinchalik
    // o'zgartirilsa, alohida chaqirilgan detectDirectionCategory natijasi u bilan
    // mos kelmasligi mumkin edi.
    // Endi: bitta joyda hisoblab, classify() davomida FAQAT shu natijadan
    // foydalaniladi — hech qayerda qayta chaqirilmaydi.
    const entities = this.extractEntities(cleanMessage);
    const detectedDirection = entities.direction;

    // ===== STRONG RECOMMENDATION SIGNALS =====
    // Bu signallar mavjud bo'lsa, BARCHA boshqa intentlarni override qiladi (greeting'dan tashqari).
    //
    // TUZATISH #5: ilgari bu regexda yalang'och "qaysi universitet" / "qaysi yo'nalish"
    // bor edi — bu "Qaysi universitetlarda AI bor?" kabi ODDIY KATALOG so'rovlarini
    // ham noto'g'ri recommendation'ga aylantirib yuborardi (aslida bu direction_search
    // bo'lishi kerak). Endi faqat ANIQ maslahat so'rovlarini bildiruvchi iboralar
    // qoldirildi: "qaysi ... tanlasam", "qaysi biri menga mos/yaxshi", "nima tavsiya
    // qilasiz" va h.k. — bular haqiqatan foydalanuvchi tanlov qila olmayotganini bildiradi.
    // MUHIM (long-test FIX): "tavsiya qilingan/etilgan/berilgan" (o'tgan
    // zamon sifatdosh) YANGI tavsiya so'rash EMAS — "birinchi tavsiya qilingan
    // universitеt haqida batafsil ma'lumot bering" kabi so'rovlar recommendation
    // emas, university_detail/nav bo'lishi kerak. Shu sababli (?!gan|ingan|dilar|dik|di)
    // negativ lookahead qo'shildi: faqat hozirgi zamon / buyruq mayli signal beradi.
    // MUHIM (long-test FIX): "tavsiya qilingan/etilgan/berilgan" (o'tgan
    // zamon sifatdosh) YANGI tavsiya so'rash EMAS — "birinchi tavsiya qilingan
    // universitеt haqida batafsil ma'lumot bering" kabi so'rovlar recommendation
    // emas, university_detail/nav bo'lishi kerak. Shu sababli (?!gan|ingan|...)
    // negativ lookahead qo'shildi: faqat hozirgi zamon / buyruq mayli signal
    // beradi. "tavsiya qiling/bering" (buyruq) esa signal — shuning uchun
    // qil(?:ing)? va ber(?:ing)? alohida qo'yildi.
    // REVIEWER FIX: qiling|bering qil(?:ing)?|ber(?:ing)? tarkibida allaqachon
    // bor — redundant alternativlar olib tashlandi.
    const STRONG_REC_SIGNALS = /\b(qaysi\s+(?:universitet(?:ni)?|yo'nalish(?:ni)?|oliygohni)\s+tanla|qaysi\s+biri\s+menga\s+(?:mos|yaxshiro?q|afzal)|tavsiya\s+(?:qil(?:ing)?|ber(?:ing)?)\b|tavsiya\s+(?:qil|ber)(?!gan|ingan|dilar|dik|di\b|ding|dingiz|gansiz|ganman|ganlar)\w*|eng\s+mos(?:ini)?|5\s+ta\s+variant|ustunlik(?:lari)?\s*(?:va|,)\s*kamchilik(?:lari)?|universitet(?:lar|lari|larni|laridan|lariga|im|imni|ing|ingni)?\s+maslahat\s+(?:ber(?:ing)?|berasan|berasiz|berasizmi|berasanmi)|qaysi\s+(?:yo'nalish|kasb|soha)\s+(?:tanlasam|mos|kerak)|nima\s+tanlasam|\b(?:shunga|unga|o'shanga|shunday|xuddi\s+shunday)\s+o'xshash\b|\bunga\s+o'xshab\b|qaysi\s+biri(?:ni)?\s+(?:olsam|tanlasam|kirsam|topshirsam)|\bo'xshash\b[^.!?]{0,20}\b(?:kerak|univ\w*|universitet\w*)\b|qaysi\s+univ\w*\s+[^.!?]{0,25}?\b(?:menga\s+ko'proq\s+mos|mos\s+keladigan)\b)\b/i;
    // Direction + maslahat so'rovi birga kelsa → recommendation. "Huquq
    // yo'nalishida o'qimoqchiman, qaysi universitet yaxshi" — yo'nalish
    // aniqlangan va user maslahat so'rayapti → recommendation. Lekin yalang'och
    // "qaysi universitet yaxshiroq" (direction YO'Q) comparison bo'lib qoladi.
    const hasDirAdviceSignal =
      !!detectedDirection &&
      /\bqaysi\s+[^,.;]{0,40}?(?:universitet|oliygoh|univ\w*)[^,.;]{0,30}?(?:o'qishim|o'qisam|o'qishni|topshirsam|kirsam|yaxshi|yaxshiroq|mos|afzal)\b/i.test(cleanMessage);
    const hasStrongRecSignal = STRONG_REC_SIGNALS.test(cleanMessage) || hasDirAdviceSignal;

    // Step 1: Check each intent pattern (tartib config'dan — intent-config.json)
    let matchedIntent: string | null = null;
    let matchedConfidence = 0.5;

    for (const [intent, patterns] of Object.entries(this.patterns)) {
      if (intent === "unknown") continue;
      // MUHIM: greeting Guard ishlagan — patterns dan greeting SKIP qilamiz
      // (greetingLedLong bo'lsa, greeting pattern HECH QACHON match qilmasin)
      if (intent === "greeting" && greetingLedLong) continue;
      for (const pattern of patterns) {
        if (pattern.test(cleanMessage)) {
          matchedIntent = intent;
          matchedConfidence = getIntentPriority(intent);
          break;
        }
      }
      if (matchedIntent) break;
    }

    // TUZATISH #7: takrorlanadigan "matchedIntent faq/unknown/null" tekshiruvini
    // helper funksiyaga chiqardik — kod bo'ylab 50 marta takrorlangan shartni
    // o'qish va saqlashni osonlashtiradi. Har chaqirilganda joriy matchedIntent
    // qiymatini tekshiradi (closure orqali).
    const isUnknownIntent = () =>
      !matchedIntent || matchedIntent === "faq" || matchedIntent === "unknown";

    // ===== GRANT REVERSAL (STAGE 19, adversarial) =====
    // "Grant kerak emas... aslida grant bo'lsa yaxshi" — user FIKRINI O'ZGARTIRDI:
    // negativ "kerak emas" dan keyin ijobiy "aslida ... bo'lsa yaxshi" kelgan.
    // Oxirgi istak ustun → recommendation (grant preference), negativ blok
    // ishlamasligi uchun OLDINDAN qaytamiz.
    if (matchedIntent === "grant_search" && /\bgrant\w*\b[^!?]{0,30}\b(kerak\s+emas|shart\s+emas|istamayman|xohlamayman)\b[^!?]{0,50}\b(aslida|endi|lekin)\b[^!?]{0,50}\b(bo'lsa\s+yaxshi|kerak|xohlayman|istayman|bo'lsa\s+ham\s+bo'ladi)\b/i.test(cleanMessage)) {
      matchedIntent = "recommendation";
      matchedConfidence = 0.85;
      console.log(`[GrantReversal] → recommendation (fikr o'zgarishi): "${cleanMessage.substring(0, 60)}"`);
    }

    // ===== GRANT NEGATIV ISTAK (STAGE 15e) =====
    // "grant shart emas", "grant kerak emas", "grant istamayman" — grant
    // QIDIRUVI emas, rad etilgan imtiyoz. "grant" so'zi grant_search
    // pattern'iga tushib qoladi. Qiziqish/university bor bo'lsa → recommendation
    // (preference), aks holda faq (suhbat — nima kerakligini so'raydi).
    if (matchedIntent === "grant_search" && /\bgrant\w*\b[^.!?]{0,40}\b(shart\s+emas|kerak\s+emas|istamayman|xohlamayman|bo'lmasin|keragi\s+yo'q|umid\s+qilmayman|umid\s+yo'q|kutmayman|kutolmayman)\b/i.test(cleanMessage)) {
      // STAGE 18 (blind): "grantga umid qilmayman, o'zim to'layman" — grant rad
      // etilgan, lekin TO'LOV/KONTRAKT konteksti bor → recommendation (o'z
      // mablag'i bilan o'qish imkoniyatlari). Sof "grant shart emas" (bo'sh) → faq.
      const hasPaymentContext = /\b(to'layman|to'lay|to'laman|kontrakt|budjet|byudjet|pul)\b/i.test(cleanMessage);
      matchedIntent = detectedDirection || entities.university || hasPaymentContext ? "recommendation" : "faq";
      matchedConfidence = 0.7;
      console.log(`[GrantNegation] grant istagi rad etildi → ${matchedIntent}: "${cleanMessage.substring(0, 60)}"`);
    }

    // ===== GRANT SHARTLI ROZI (STAGE 18, blind) =====
    // "grant bo'lmasa, kontraktga rozi" — grant QIDIRUVI emas, shartli tanlov
    // bayoni (grant afzal, bo'lmasa kontrakt). "bo'lmasa" + qabul so'zi
    // (rozi/mayli/bo'ladi) → recommendation (preference).
    if (matchedIntent === "grant_search" && /\bgrant\w*\b[^.!?]{0,30}\bbo'lmasa\b[^.!?]{0,30}\b(rozi|mayli|bo'ladi|ham\s+bo'ladi|bo'lar\s+edi)\b/i.test(cleanMessage)) {
      matchedIntent = "recommendation";
      matchedConfidence = 0.85;
      console.log(`[GrantConditional] → recommendation (shartli rozi): "${cleanMessage.substring(0, 60)}"`);
    }

    // ===== GRANT PREFERENCE (STAGE 17, blind) =====
    // "20 mln bor, lekin grant chiqsa undan ham yaxshi" — grant QIDIRUVI emas,
    // shartli afzallik bayoni (budget + soft grant) → recommendation.
    if (matchedIntent === "grant_search" && /\bgrant\w*\b[^.!?]{0,40}\b(chiqsa|bo'lsa|olsam|yutsam|tushsa|berilsa)\b[^.!?]{0,30}\b(yaxshi|zo'r|afzal|yaxshiroq|bo'ladi|ham\s+bo'ladi)\b/i.test(cleanMessage)) {
      matchedIntent = "recommendation";
      matchedConfidence = 0.85;
      console.log(`[GrantPreference] → recommendation (shartli grant afzalligi): "${cleanMessage.substring(0, 60)}"`);
    }

    // ===== KONTRAKT PREFERENCE (STAGE 15e) =====
    // "Grant kerak, kontrakt ham bo'lishi mumkin" — kontrakt NARX so'rovi EMAS
    // (qancha/necha/bormi/narxi yo'q), grant afzalligi + kontrakt imkoniyati
    // bayoni. Yalang'och "kontrakt" so'zi tuition_search pattern'iga tushib
    // qoladi → recommendation ga o'tkazamiz (preference bayoni).
    if (matchedIntent === "tuition_search" &&
        /\bgrant\w*\b[^.!?]{0,40}\b(kerak|bo'lsa\s+yaxshi|istayman|xohlayman)\b/i.test(cleanMessage) &&
        !/\b(qancha|necha|bormi|narx|narhi|narxi|to'lovi|arzon)\b/i.test(cleanMessage)) {
      matchedIntent = "recommendation";
      matchedConfidence = 0.85;
      console.log(`[TuitionPreference] → recommendation (grant + kontrakt imkoniyati): "${cleanMessage.substring(0, 60)}"`);
    }

    // ===== TUITION VAZIYAT/ISTAK (STAGE 17, blind) =====
    // "bizda pul yo'q, davlat universiteti bo'lsa yaxshi edi" (byudjet cheklovi +
    // istak), "grant ololmadim, endi kontrakt to'lay olamanmi" (vaziyat) —
    // katalog EMAS, user maslahat kutyapti → recommendation. Sof NARX so'rovi
    // ("kontrakti qancha?") tuition_search qoladi.
    if (matchedIntent === "tuition_search" && !/\b(qancha|necha|bormi|ro'yxati)\b/i.test(cleanMessage)) {
      const hasWishSignal = /\b(bo'lsa\s+yaxshi\s+(?:edi|bo'lardi)?|bo'lsa\s+bo'ldi|qani\s+edi|kerak\s+edi|xohlashyapti|xohlashadi|xohlaymiz)\b/i.test(cleanMessage);
      const hasSituationSignal = /\b(ololmadim|olmadim|olmadi|yetmadi|yetmayapman|kirmadim|kirolmadim|o'tolmadim|tusholmadim|ballim\s+yetmadi)\b/i.test(cleanMessage);
      // STAGE 18 (blind): "narxi muhim emas" — narx so'rovi EMAS, afzallik bayoni
      const hasPriceIndifference = /\b(narx\w*|pul\w*|to'lov\w*)\b[^.!?]{0,30}\b(muhim\s+emas|ahamiyati\s+yo'q|shart\s+emas)\b/i.test(cleanMessage);
      if (hasWishSignal || hasSituationSignal || hasPriceIndifference) {
        matchedIntent = "recommendation";
        matchedConfidence = 0.85;
        console.log(`[TuitionSituation] → recommendation (istik/vaziyat): "${cleanMessage.substring(0, 60)}"`);
      }
    }

    // Step 2a0: MASLAHAT OVERRIDE — user O'ZI nima qilishini bilmay, maslahat so'rayapti.
    // MUHIM (Fix): "Men tarix faniga qiziqaman lekin qanday universitetda o'qishni
    // bilmayman" → direction_search/university_search EMAS, recommendation bo'lishi kerak!
    // Nima uchun? User universitet qidirmayapti — u MASLAHAT so'rayapti (qiziqishi bor,
    // lekin qayerda o'qishni bilmaydi). Keyingi so'zlar buni bildiradi:
    //   - "bilmayman" + qiziqish → tavsiya kerak
    //   - "qaysi ... tanlasam / tanlashim / tanlamoqchi" → tavsiya kerak
    //   - "qanday ... o'qishni" + qiziqish → tavsiya kerak
    //
    // MUHIM: STRONG_REC_SIGNALS mavjud bo'lsa — har qanday intentni
    // recommendation ga override qilamiz (greeting'dan tashqari).
    // BOSQICH 14: explanation ("nega aynan TATU?", "nima uchun shu?") —
    // "tavsiya qilding" o'tgan zamonli so'rov STRONG_REC_SIGNALS'ga tushib
    // recommendation bo'lib ketmasligi kerak. "nega ... tavsiya qilding?"
    // — bu yangi tavsiya so'rash EMAS, oldingi tavsiya sababini so'rash.
    if (hasStrongRecSignal && matchedIntent !== "greeting" && matchedIntent !== "explanation") {
      matchedIntent = "recommendation";
      matchedConfidence = 0.92;
      console.log(`[StrongRecOverride] → recommendation (strong signals): "${cleanMessage.substring(0, 80)}"`);
    }

    // FIX (BOSQICH 14, long-test): "Menga ... tavsiya qilib bering va nima
    // uchun ... tushuntiring" — UZUN savolda "nima uchun ... tushuntiring"
    // iborasi explanation'ga tushib, tavsiya so'rovini yutib yuboradi. Qoida:
    // message'da HOZIRGI ZAMON tavsiya so'rovi ("tavsiya qilib bering/ber/
    // qiling") bo'lsa → recommendation ustun (asosiy maqsad tavsiya),
    // "tavsiya qilding/qildiz" (o'tgan zamon — sabab so'rash) → explanation.
    // MUHIM (FIX): hasPresentRecommendAsk faqat HOZIRGI ZAMON / buyruq
    // maylidagi tavsiya so'rovlarini ushlasin — "tavsiya qilib bering",
    // "tavsiya qil", "tavsiya eting". O'tgan zamon ("tavsiya qildingiz",
    // "tavsiya qilib berdingiz") sabab so'rash (explanation) bo'lib qoladi.
    // !hasStrongRecSignal sharti YO'Q — chunki "tavsiya qilib bering"
    // STRONG_REC_SIGNALS'ga ham tushadi va bu override'ni bloklab qo'yardi.
    const hasPresentRecommendAsk =
      /\b(tavsiya\s+(?:qilib\s+|etib\s+)?(?:ber(?:ing)?|qil(?:ing)?|et(?:ing)?))\b/i.test(cleanMessage) &&
      !/\b(tavsiya\s+(?:qilib\s+|etib\s+)?(?:ber|qil|et)(?:di|ding|dik|dilar|gan|ganman|gansiz|ganlar))\b/i.test(cleanMessage);
    if (matchedIntent === "explanation" && hasPresentRecommendAsk) {
      matchedIntent = "recommendation";
      matchedConfidence = 0.9;
      console.log(`[ExplanationFix] uzun tavsiya so'rovi → recommendation: "${cleanMessage.substring(0, 80)}"`);
    }

    // greetingLedLong: Salomlashish + uzun gap → recommendation (agar boshqa intent topilmasa)
    if (greetingLedLong && (!matchedIntent || matchedIntent === "greeting")) {
      matchedIntent = "recommendation";
      matchedConfidence = 0.78;
      console.log(`[GreetingLedLong] → recommendation (greeting + long message): "${cleanMessage.substring(0, 80)}"`);
    }

    // Negativ guard (MUHIM): "qaysi yaxshi" comparison'da, "qaysi universitet"
    // university_search pattern'ida bor. Faqat maslahat/aniqlash so'zlari bilan
    // birga kelganda recommendation ga o'tkazamiz — aks holda oddiy katalog buziladi.
    // "Men AI bo'yicha ishlamoqchiman" (kasb/istek) → direction_search + hybrid (Step 1.7).
    //
    // 2 xil maslahat so'rovi:
    //  a) ANIQ tanlov so'zi: "tanlasam", "tanlamoqchiman" — o'zi maslahat ekanini bildiradi
    //     ("Qaysi universitetni tanlasam bo'ladi?" → qiziqish shartsiz recommendation)
    //  b) Qiziqish + bilmaslik: "X ga qiziqaman, qanday o'qishni bilmayman" → recommendation
    const hasExplicitChoiceWord = /\b(tanlasam|tanlashim|tanlamoqchiman|tanlashni|tanlashga|tanlov|topishim|toplamoqchiman|topshiramiz|topshirishimiz|tanlaymiz|tanlashimiz)\b/i.test(cleanMessage);
    const hasInterestWithConfusion =
      hasInterestPhrase(cleanMessage) &&
      (/\b(bilmayman|bilmay|bilamanmi|tushunmayapman)\b/i.test(cleanMessage) ||
       /\b(qanday|qaysi|qanaqa)\s+(universitet|oliygoh|joy|o'rin|maskan)\w*\s+(o'qish|tanlash|topish)\b/i.test(cleanMessage));

    // MUHIM (Fix v2): direction + PROFIL SIGNALLARI birga kelsa → recommendation!
    // "IT ga qiziman lekin matematikam yaxshi emas" — user faqat katalog so'ramayapti,
    // u o'z profilini aytib MASLAHAT kutyapti.
    //
    // TUZATISH #4: ilgari BITTA profil signali (masalan yolg'iz "B2" til darajasi)
    // ham yetarli edi — bu noto'g'ri edi, chunki "IT ga qiziqaman. Ingliz tilim B2."
    // kabi oddiy ma'lumot berish recommendation ga aylanib qolardi, garchi bu shunchaki
    // qo'shimcha ma'lumot bo'lib, chuqur maslahat so'ralmagan bo'lsa ham. Endi KAMIDA
    // IKKITA mustaqil profil signali (zaiflik, qarama-qarshilik "lekin", til darajasi)
    // birga kelishi talab qilinadi — bu haqiqatan "murakkab profilim bor, menga mos
    // variantni tanlashda yordam kerak" degan holatni ancha aniqroq ushlaydi.
    const hasWeaknessSignal = /\b(yaxshi emas|zo'r emas|kuchli emas|past|zaif|unchalik emas|yaxshi bilmayman|yetarli emas)\b/i.test(cleanMessage);
    const hasContrast = /\blekin\b/i.test(cleanMessage);
    const hasLangLevel = /\b(IELTS|TOEFL|SAT|C1|C2|B2|B1)\b/i.test(cleanMessage);
    const profileSignalCount = [hasWeaknessSignal, hasContrast, hasLangLevel].filter(Boolean).length;
    // STAGE 17 (blind): qiziqish + qarama-qarshilik ("IT yoqadi, lekin ota-onam
    // iqtisod o'qishingni xohlashyapti") — haqiqiy TANLOV ZIDDIYATI →
    // recommendation (maslahat). Qiziqish so'zi talab qilinadi — oddiy
    // katalog so'rovlari bu orqali recommendation'ga aylanib ketmaydi.
    const hasProfileContext = profileSignalCount >= 2 || (hasContrast && hasInterestPhrase(cleanMessage));
    const hasOwnDirectionNow = !!detectedDirection;
    const isProfileRecommendation = hasOwnDirectionNow && hasProfileContext;
    // STAGE 17 (blind): "faqat tibbiyot qiziqtiradi", "ITdan boshqa o'qigim
    // kelmaydi" — katalog so'rovi emas, ANIQ afzallik bayoni (direction bor) →
    // recommendation (user o'z tanlovini aniqlab, variantlar kutyapti).
    const hasExclusivePreference =
      (hasOwnDirectionNow &&
        (/\b(faqat)\b[^.!?]{0,30}\b(qiziqtiradi|qiziqaman|kerak|o'qimoqchiman|qarayman|ko'raman)\b/i.test(cleanMessage) ||
         /\b(\w+)dan\s+boshqa\b[^.!?]{0,40}\b(kelmaydi|yo'q\b|emas\b|o'qimayman|xohlamayman)\b/i.test(cleanMessage)));
    // STAGE 17 (blind): KATEGORIYA BEFARQLIGI — "Xususiy ham davlat ham farqi
    // yo'q", "davlat yoki xususiy muhim emas" — user kategoriyaga befarq,
    // universitet tanlovi kontekstida gapiryapti → recommendation (maslahat).
    const hasCategoryIndifference =
      /\b(?:xususiy|davlat|xalqaro|nodavlat|private|state)\b[^.!?]{0,30}\b(farqi\s+yo'q|muhim\s+emas|ahamiyati\s+yo'q)\b/i.test(cleanMessage) ||
      /\b(farqi\s+yo'q|muhim\s+emas)\b[^.!?]{0,30}\b(?:xususiy|davlat|xalqaro)\b/i.test(cleanMessage);
    const isAdviceRequest = hasExplicitChoiceWord || hasInterestWithConfusion || isProfileRecommendation || hasExclusivePreference || hasCategoryIndifference;
    if (isAdviceRequest &&
        (matchedIntent === "university_search" || matchedIntent === "university_detail" ||
         matchedIntent === "direction_search" || matchedIntent === "faq" || matchedIntent === null)) {
      matchedIntent = "recommendation";
      matchedConfidence = 0.88;
      console.log(`[AdviceOverride] → recommendation (maslahat so'rovi + qiziqish): "${cleanMessage.substring(0, 80)}"`);
    }

    // Step 2a: Override — agar message da direction keywords (yo'nalish, IT, dasturlash) bo'lsa
    // va university_search ga tushgan bo'lsa → direction_search ga o'tkazamiz!
    // Sababi: "Toshkent shahridagi Amity Universiteti IT ga qiziqaman" → shahar patterni
    // university_search ni trigger qiladi, lekin aslida direction_search kerak!
    if (matchedIntent === "university_search" || matchedIntent === "university_detail") {
      // MUHIM: university_detail ham university_search'ning egizagi — JSON config'dan
      // kelgan yangi intent (BOSQICH 4), direction keyword'lar uni ham direction_search'ga
      // o'tkazishi kerak. Aks holda "batafsil IT ga qiziqaman" search_university'ga tushib qoladi.
      //
      // MUHIM (E2E tuzatish): degree/ta'lim shakli so'zlari (bakalavr, magistratura,
      // kunduzgi, sirtqi...) "universitet" so'zi BILAN birga kelsa — bu UNIVERSITET
      // FILTRI, direction signal emas! "Toshkentdagi kunduzgi bakalavr universitetlar"
      // → university_search (degree filter bilan). Faqat "universitet" so'zi YO'Q
      // bo'lganda direction_search ga o'tamiz.
      //
      // Kuchli signal (har doim o'tkazadi): yo'nalish/dastur/mutaxassislik/qiziqish
      // — "Samarqand davlat universitetida qanday yo'nalishlar bor", "... IT ga qiziqaman"
      const hasStrongDirectionSignal = /\b(yo'nalish(?:lar|lari|larini|lariga|laridan|larining|laridagi)?|dastur(?:lar|lari)?|mutaxassislik(?:lar|lari)?|qiziqaman|qiziqasan|qiziqadi|bo'lmoqchiman|o'qimoqchiman)\b/i.test(cleanMessage);
      // Zaif signal (faqat "universitet" so'zi bo'lmasa): IT/dasturlash/daraja
      // MUHIM: kunduzgi/sirtqi/kechki/masofaviy — ta'lim shakli, direction EMAS!
      const hasWeakDirectionSignal = /\b(IT|dasturlash|injiniring|bakalavr|magistr|magistratura)\b/i.test(cleanMessage);
      // MUHIM: \w* ko'plik/egalik shakllarini ham ushlaydi — "universitetlar", "universitetida"
      const hasUniversityRef = /\b(universitet\w*|university\w*|oliygoh\w*|institut\w*)\b/i.test(cleanMessage);

      if (hasStrongDirectionSignal || (hasWeakDirectionSignal && !hasUniversityRef)) {
        matchedIntent = "direction_search";
        matchedConfidence = 0.85;
        console.log(`[Override] university_search → direction_search (message has direction keywords): "${cleanMessage.substring(0, 80)}..."`);
      }
    }

    // ===== STAGE 18 (blind) QO'SHIMCHA GUARDS =====

    // DELEGATSIYA: "bilmayman, o'zingiz hal qiling" — user qarorni AGENTGA
    // topshirmoqda, tavsiya so'ramayapti. Config'dagi "bilmayman" pattern'iga
    // tushib recommendation bo'lib qoladi → faq (aniqlashtiruvchi suhbat).
    if (matchedIntent === "recommendation" && /\b(o'zingiz|o'zing)\s+(hal\s+qiling|qiling|bilasiz|qaror\s+qiling)\b/i.test(cleanMessage)) {
      matchedIntent = "faq";
      matchedConfidence = 0.7;
      console.log(`[DelegationGuard] → faq (qaror agentga topshirildi): "${cleanMessage.substring(0, 60)}"`);
    }

    // ADMISSION NEGATIV: "bu yil kirishni xohlamayman, keyingi yil" — kirish
    // QIDIRUVI emas, kechiktirish bayoni → general_chat (suhbat).
    if (matchedIntent === "admission" && /\b(kirish|o'qish)\w*\s+(xohlamayman|istamayman|bo'lmasin)\b/i.test(cleanMessage)) {
      matchedIntent = "general_chat";
      matchedConfidence = 0.75;
      console.log(`[AdmissionNegation] → general_chat (kechiktirish): "${cleanMessage.substring(0, 60)}"`);
    }

    // NEWS + UNIVERSITET FIKRI: "yangi ochilgan universitetga ishonmayman" —
    // yangiliklar so'rovi EMAS, user universitеt haqida FIKR bildirmoqda → faq.
    if (matchedIntent === "news_search" && /\b(universitet|oliygoh|institut)\w*\b/i.test(cleanMessage) &&
        /\b(ishonmayman|ishonmay|ishonmagan|xohlamayman|kerak\s+emas|bo'lmasin|istamayman|qo'rqaman)\b/i.test(cleanMessage)) {
      matchedIntent = "faq";
      matchedConfidence = 0.7;
      console.log(`[NewsOpinionGuard] → faq (universitеt haqida fikr): "${cleanMessage.substring(0, 60)}"`);
    }

    // FIELD QUERY (sayt/manzil/link/telefon): "PDP sayti bormi", "TATU manzili
    // qayerda" — to'liq karta EMAS, bitta field so'rovi. Universitet BOR bo'lsa
    // → university_search (field filter); universitetsiz (kontekstsiz) → faq
    // (aniqlashtirish — keyingi follow-up konteksti bog'laydi).
    // "TATU haqida batafsil ayt" (batafsil so'zi) university_detail qoladi.
    if (matchedIntent === "university_detail" && /\b(sayt|websayt|web\s*sayt|link|manzil|address|telefon|raqam|kontakt)\w*\b/i.test(cleanMessage) &&
        /\b(bormi|qancha|nima|qayerda|qaerda|necha|qanday|ayt)\b/i.test(cleanMessage)) {
      matchedIntent = entities.university ? "university_search" : "faq";
      matchedConfidence = 0.8;
      console.log(`[FieldQuery] university_detail → ${matchedIntent} (field): "${cleanMessage.substring(0, 60)}"`);
    }

    // ARZON YO'NALISH: "eng arzon IT univlari" — yo'nalish qidiruvi EMAS,
    // narx bo'yicha saralash → tuition_search (arzonlik ustun).
    if (matchedIntent === "direction_search" && /\b(eng\s+arzon|arzonroq|arzoni|arzonlari)\b/i.test(cleanMessage)) {
      matchedIntent = "tuition_search";
      matchedConfidence = 0.82;
      console.log(`[ArzonOverride] direction_search → tuition_search (arzon): "${cleanMessage.substring(0, 60)}"`);
    }

    // Step 2b: Override — grant + universitet = university_search
    // Sababi: "Toshkent davlat yuridik universitetida grant bormi" 
    // deyilsa, grant_info university description da bor, grant endpoint emas
    if (matchedIntent === "grant_search") {
      const hasUniKeyword = /\b(universitet|oliygoh|institut|TKXU|TKTU|SamDU|TDTU|TDYU|TDIU|BuxDU)\b/i.test(cleanMessage);
      const hasSpecificUni = !!entities.university;
      if (hasUniKeyword || hasSpecificUni) {
        matchedIntent = "university_search";
        matchedConfidence = 0.85;
      }
    }

    // Step 2c: RULE-BASED FALLBACK — yo'nalish sinonimi topilsa → direction_search
    // MUHIM: AI/intent xato qilsa ham (faq yoki unknown ga tushsa ham) bu qoida
    // tuzatadi. "meditsinaga qiziqaman", "vrach bo'lmoqchiman", "tibbiyotga
    // aloqador" kabi so'rovlar faq ga tushib qolmasligi uchun.
    const wordCountAt2c = cleanMessage.trim().split(/\s+/).length;
    // MUHIM (prod fix): "Ingliz tilidagilari", "ruschasidagilari" kabi BARE
    // language follow-up'lar direction EMAS — university filter! "ingliz tili"
    // filologiya sinonimi sifatida detectDirectionCategory tomonidan topilsa ham,
    // qisqa so'z + language entity bo'lsa direction_search'ga o'tkazilmaydi
    // (Step 2h uni university_search qiladi). "Ingliz tili yo'nalishlari"
    // (4+ so'z, "yo'nalish" so'zi) esa direction_search bo'lib qoladi.
    const isBareLanguageFollowUp =
      !!entities.language &&
      wordCountAt2c <= 3 &&
      !/\b(yo'nalish|dastur|mutaxassislik|soha|qiziqaman|o'qimoqchiman|kerak|o'rganmoqchiman)\b/i.test(cleanMessage);
    if (detectedDirection && !isBareLanguageFollowUp) {
      // Agar direction sinonimi bor bo'lsa va intent faq/unknown bo'lsa → direction_search
      if (isUnknownIntent()) {
        matchedIntent = "direction_search";
        matchedConfidence = 0.85;
        console.log(`[RuleFallback] → direction_search (direction: ${detectedDirection}): "${cleanMessage.substring(0, 80)}"`);
      } else if ((matchedIntent === "university_search" || matchedIntent === "university_detail") && (hasInterestPhrase(cleanMessage) || /\b(yo'nalish|qiziqaman|qiziqasan|qiziqadi|bo'lmoqchiman|o'qimoqchiman|yaxshi ko'raman|kerak)\b/i.test(cleanMessage))) {
        // "Toshkent shahridagi Amity Universiteti IT ga qiziqaman" → direction_search
        // (university_detail ham shu qoidaga bo'ysunadi — egizak intent)
        matchedIntent = "direction_search";
        matchedConfidence = 0.85;
        console.log(`[RuleFallback] university_search → direction_search: "${cleanMessage.substring(0, 80)}"`);
      } else if ((matchedIntent === "university_search" || matchedIntent === "university_detail") && !entities.university && !entities.language && /\b(universitet|oliygoh|institut|akademiya)(lar|lari|larida|laridan|lariga|larda|dagi|larini|larining)?\b/i.test(cleanMessage)) {
        // MUHIM (prod fix): "Tibbiyot universitetlari", "Samarqanddagi tibbiyot
        // universitetlari" — kategoriya sinonimi + UMUMIY universitet so'zi
        // (aniq nom emas) → direction_search (o'sha yo'nalish bor universitetlar
        // topiladi). "Toshkent tibbiyot akademiyasi" (aniq nom, university entity
        // bor) esa university_search bo'lib qoladi.
        //
        // MUHIM (prod fix): language entity bo'lsa o'tkazilmaydi! "Ingliz tilida
        // o'qitadigan universitetlar" — user ingliz tilidagi univlarni so'rayapti
        // (university_search + language filter), filologiya yo'nalishini EMAS.
        matchedIntent = "direction_search";
        matchedConfidence = 0.85;
        console.log(`[RuleFallback] university_search → direction_search (category+generic uni ref): "${cleanMessage.substring(0, 80)}"`);
      } else if (matchedIntent === "recommendation" && !/\b(tavsiya|maslahat|tanla|tanlash|qaysi|afzal|yaxshiroq)\b/i.test(cleanMessage) && (/\b(yo'nalish(?:lar|lari|larini|lariga|laridan|larining|i|iga|ida|idagi)?|kirmoqchi|o'rganmoqchiman)\b/i.test(cleanMessage) || /\b(universitet|oliygoh|institut|akademiya)(lar|lari|larini|larining|larda)?\b/i.test(cleanMessage))) {
        // "tibbiyot yo'nalishiga o'qishga kirmoqchiman" → direction_search
        // (foydalanuvchi YO'NALISHNI ANIQ aytgan — recommendation emas!)
        // Lekin "men bu yil o'qishga kirmoqchiman" (yo'nalishsiz) → recommendation qoladi.
        // Negativ guard: "tavsiya qiling" kabi ANIQ tavsiya so'rovi bo'lsa → recommendation qoladi.
        matchedIntent = "direction_search";
        matchedConfidence = 0.85;
        console.log(`[RuleFallback] recommendation → direction_search (explicit direction): "${cleanMessage.substring(0, 80)}"`);
      }
    }

    // Step 2d: Qiziqish/istak so'zlari + yo'nalish sinonimi → direction_search
    // "qiziqaman" yoki "bo'lmoqchiman" kabi so'zlar faqat yo'nalish sinonimi bilan
    // birga direction_search ni bildiradi. Masalan: "IT ga qiziqaman" → direction_search
    if (!matchedIntent && hasInterestPhrase(cleanMessage)) {
      if (detectedDirection) {
        matchedIntent = "direction_search";
        matchedConfidence = 0.85;
      } else {
        // Faqat qiziqish so'zi bor, yo'nalish aniq emas → recommendation (aniqlashtirish)
        matchedIntent = "recommendation";
        matchedConfidence = 0.6;
        console.log(`[RuleFallback] → recommendation (interest, no direction): "${cleanMessage.substring(0, 80)}"`);
      }
    }

    // Step 2e: direction_list ga tushgan bo'lsa-yu, lekin ANIQ yo'nalish kategoriyasi
    // yoki ANIQ universitet nomi ham topilgan bo'lsa → direction_search (katalog emas, aniq so'rov).
    // Masalan: "qanday tibbiyot yo'nalishlari mavjud" → direction_search
    //          "Samarqand davlat universitetida qanday yo'nalishlar bor" → direction_search (shu universitet)
    if (matchedIntent === "direction_list") {
      if (detectedDirection || entities.university || /\buniversiteti(da|ning|ga|ni)?\b/i.test(cleanMessage)) {
        matchedIntent = "direction_search";
        matchedConfidence = 0.85;
        console.log(`[RuleFallback] direction_list → direction_search (specific category/university): "${cleanMessage.substring(0, 80)}"`);
      }
    }

    // Step 2f: university_list ga tushgan bo'lsa-yu, lekin ANIQ universitet nomi
    // topilgan bo'lsa → university_search (katalog emas, aniq so'rov).
    if (matchedIntent === "university_list" && entities.university) {
      matchedIntent = "university_search";
      matchedConfidence = 0.85;
      console.log(`[RuleFallback] university_list → university_search (specific university): "${cleanMessage.substring(0, 80)}"`);
    }

    // Step 2h: Yalang'och egalik/ko'plik shakllari (follow-up) → university_search
    // BOSQICH 3 (Context Manager): "bakalavrlari", "inglizchasiga", "magistrlari",
    // "20 mln gachasi" kabi qisqa follow-up so'zlar faq/unknown bo'lib qolmasligi
    // uchun university_search ga o'tkaziladi — keyin follow-up konteksti qo'shiladi.
    // MUHIM (Fix 17): region ham shu yerga kiradi! "Samarqanddagilari",
    // "Andijondagilari" kabi joylashuv follow-up'lari region entity beradi —
    // university_search ga o'tkazilmasa faq bo'lib "topa olmadim" qaytadi.
    if (isUnknownIntent()) {
      const wordCount = cleanMessage.trim().split(/\s+/).length;
      // ANIQ universitet nomi topilgan bo'lsa — so'z sonidan qat'i nazar university_search.
      // Masalan "Akfa Med haqida ma'lumot" (4 so'z) faq bo'lib qolmasligi kerak.
      if (entities.university) {
        matchedIntent = "university_search";
        matchedConfidence = 0.85;
        console.log(`[RuleFallback] → university_search (university entity): "${cleanMessage.substring(0, 80)}"`);
      } else if (wordCount <= 3) {
        if (
          entities.degree || entities.language || entities.educationType ||
          entities.institutionCategory || entities.region ||
          entities.tuitionMin !== undefined || entities.tuitionMax !== undefined
        ) {
          matchedIntent = "university_search";
          matchedConfidence = 0.75;
          console.log(`[RuleFallback] → university_search (bare follow-up attribute): "${cleanMessage.substring(0, 80)}"`);
        }
      } else if (entities.language && /\b(shart\s+emas|muhim\s+emas|ham\s+bo'ladi|bo'ladi\b|yetarli|tilida)\b/i.test(cleanMessage)) {
        // STAGE 18 (blind): "qoraqalpoq tilida o'qiydigan bormi", "ingliz tili
        // shart emas, rus tilida ham bo'ladi" — til filtri/afzalligi (so'z soni
        // cheklovidan tashqari) → university_search.
        matchedIntent = "university_search";
        matchedConfidence = 0.75;
        console.log(`[RuleFallback] → university_search (language preference): "${cleanMessage.substring(0, 80)}"`);
      }
    }

    // Step 2i: direction_search ga tushgan BARE degree/educationType/language follow-up → university_search
    // MUHIM: "bakalavrlari", "magistrlari", "kunduzgilari", "Ingliz tilidagilari"
    // kabi so'zlar direction_search pattern'iga (/(bakalavr|magistr|...)/i,
    // /(kunduzgi|sirtqi|...)/i, "ingliz tili" filologiya sinonimi) tushib qoladi.
    // Lekin ular aslida UNIVERSITET FILTRI (degree/educationType/language), yo'nalish
    // emas! Agar shu yo'nalish search'ga borsa, "bakalavrlari" kalit so'zi hech qanday
    // yo'nalish nomiga mos kelmaydi → bo'sh natija. Shuning uchun university_search.
    //
    // MUHIM (prod fix): so'z soni cheklovi YO'Q — chunki follow-up konteksti
    // qo'shilgach "davlat Toshkent shahri Ingliz tilidagilari" (5 so'z) bo'lib qoladi.
    // Lekin aniq yo'nalish so'zi ("yo'nalishlari", "qiziqaman"...) bo'lsa direction qoladi.
    if (matchedIntent === "direction_search") {
      // MUHIM (prod fix): language ham bu yerga kiradi — "Ingliz tilidagilari",
      // "ruschasidagilari" kabi bare language follow-up'lar degree/educationType
      // kabi university filter — direction_search EMAS!
      // STAGE 18 (blind): ta'lim shakli so'zi negativ bo'lsa ham ("kunduzgi
      // bo'lmasin") entity o'chirilgan bo'ladi — lekin shakl mention'i O'ZI
      // university filter (katalog) → university_search.
      const hasDegreeOrET = entities.degree || entities.educationType || entities.language ||
        /\b(kunduzgi|sirtqi|kechki|masofaviy)\w*\b/i.test(cleanMessage);
      // Aniq yo'nalish sinonimi yoki yo'nalish/dastur kalit so'zi bo'lsa → direction_search qoladi
      // MUHIM: egalik/ko'plik shakllari ham! "yo'nalishlari", "dasturlari", "kurslari"
      // kabi so'zlar ham direction_search ni anglatadi ("bakalavr yo'nalishlari").
      //
      // MUHIM (reviewer fix): hasDirectionEntity guard qaytadi — "IT magistratura"
      // kabi so'rov direction_search bo'lishi kerak (direction=it + degree=master),
      // university emas! Lekin language'dan kelgan "filologiya" ("Ingliz tilidagilari"
      // → "ingliz tili" sinonimi → filologiya) direction sifatida QABUL QILINMAYDI.
      const langDerivedDir = entities.direction === "filologiya" && !!entities.language;
      const hasDirectionKeyword = /\b(yo'nalish(?:lar|lari|larining|larini|lariga|laridan)?|dastur(?:lar|lari|larining|larini)?|mutaxassislik(?:lar|lari)?|program(?:lar|lari)?|kurs(?:lar|lari)?|qiziqaman|bo'lmoqchiman|o'qimoqchiman|o'rganmoqchiman|kirmoqchiman)\b/i.test(cleanMessage);
      if (hasDegreeOrET && (langDerivedDir || !entities.direction) && !hasDirectionKeyword) {
        matchedIntent = "university_search";
        matchedConfidence = 0.75;
        console.log(`[RuleFallback] direction_search → university_search (bare degree/educationType/language): "${cleanMessage.substring(0, 80)}"`);
      }
    }

    // ===== GENERAL CHAT OVERRIDE (INTENT CLASSIFICATION FIX) =====
    // Foydalanuvchi UNIVERSITET qidirmayapti — u ruhiy qo'llab-quvvatlash /
    // umumiy hayot maslahati so'rayapti. "Salom. Men bu yil imtihondan
    // yiqildim, lekin universitetda o'qishni orzu qilaman. Qanday maslahat
    // berasan?" → recommendation EMAS, general_chat bo'lishi kerak!
    //
    // Nima uchun tool'ga yuborish noto'g'ri:
    //   - recommendation tool ixtiyoriy "qaysi shahar? qaysi yo'nalish?" deb
    //     so'raydi — lekin user maslahat so'rayapti, tanlov emas
    //   - "universitet" so'zining o'zi recommendation triggeri EMAS
    //     ("Men universitetga kira olmadim" → maslahat, qidiruv emas!)
    //
    // NEGATIVE PATTERNS (NOT_RECOMMEND): maslahat, nima qilay, orzu qilaman,
    // imtihondan yiqildim, afsus, depressiya, ota-onam, hayot, motivatsiya...
    // Agar shular bo'lsa VA aniq tavsiya so'rovi bo'lmasa → general_chat.
    //
    // WHITELIST (EXPLICIT RECOMMEND TRIGGERS): faqat shu iboralar bilan
    // recommendation ishlaydi: "qaysi universitet", "universitet tavsiya qil",
    // "tanlasam", "topshirsam", "menga mos", "o'qishga kirmoqchiman"...
    // MUHIM (fix): "yeqildim" (typo) ham ushlanadi — real foydalanuvchi shunday
    // yozadi. "nima qilsam" ham qo'shildi (ilgari faqat qilaman/qilay bor edi).
    const GENERAL_CHAT_NEGATIVE =
      /\b(maslahat|orzu\s+qilaman|(?:imtihondan\s+)?(?:yiqildim|yeqildim|yigildim|yiqilib|yeqilib)|afsus|depressiya|tushkunlik|ota-onam|motivatsiya|ruhiy|umidsiz|yig'layapman|yig'lab|nima\s+(?:qilay|qilaman|qilishim|qilsam)|olmadim|kirmadim|hayot|hayotim|qo'rqaman|qiynalayapman|tushkun)\b/i;
    const EXPLICIT_REC_TRIGGER =
      /\b(qaysi\s+(universitet|oliygoh|yo'nalish|soha|kasb)|universitet\s+(tavsiya|tanla|top|izla)|tavsiya\s+(qil|ber)|tanlasam|tanlashim|tanlamoqchiman|topshirsam|mos\s+(universitet|keladigan)|qayerga\s+(kirsam|topshirsam)|nima\s+o'qisam|o'qishga\s+(kirmoqchi|topshirmoqchi)|o'qimoqchiman|topshirmoqchiman|universitet\s+izlayapman)\b/i;
    // MUHIM (reviewer fix): override FAQAT suhbat-masalhat intentlariga qo'llanadi
    // (recommendation/admission/transfer/faq/unknown). DATA intent'lar (grant_search,
    // tuition_search, university_search, comparison...) negativ so'z uchrasa ham
    // HIJACK qilinmaydi — aks holda "grant yutmoqchiman, maslahat bering" kabi
    // so'rov real grant ma'lumotini yo'qotib, umumiy chatga tushib qolardi.
    const isConversationalTarget =
      !matchedIntent ||
      matchedIntent === "recommendation" ||
      matchedIntent === "admission" ||
      matchedIntent === "transfer" ||
      matchedIntent === "faq" ||
      matchedIntent === "unknown";
    // MUHIM (Stage 15 fix): STRONG_REC_SIGNALS match bo'lsa GeneralChat override
    // ishlamaydi — "Qanday universitetlarni maslahat berasan?" kabi ANIQ tavsiya
    // so'rovini ruhiy chatga yutib yubormaslik kerak. "maslahat" so'zi negative
    // signal (ruhiy yordam) bo'lishi mumkin, lekin "maslahat berasan/berasiz"
    // kabi tavsiya so'rovi bilan kelganda — recommendation ustun.
    const isGeneralChat =
      isConversationalTarget &&
      !hasStrongRecSignal &&
      GENERAL_CHAT_NEGATIVE.test(cleanMessage) &&
      !EXPLICIT_REC_TRIGGER.test(cleanMessage) &&
      !detectedDirection &&
      !entities.university &&
      matchedIntent !== "greeting" &&
      matchedIntent !== "thanks";
    if (isGeneralChat) {
      matchedIntent = "general_chat";
      matchedConfidence = 0.8;
      console.log(`[GeneralChat] → general_chat (maslahat/ruhiy signal): "${cleanMessage.substring(0, 80)}"`);
    }

    // Step 3: Compute secondaryIntents (Multi-Intent Extraction)
    // TUZATISH #2/#3: endi qayta extractEntities() chaqirilmaydi, yuqorida
    // hisoblangan `entities` obyektidan foydalaniladi.
    const secondaryIntents: string[] = [];
    if (entities.tuitionMax !== undefined || entities.tuitionMin !== undefined) secondaryIntents.push("budget_filter");
    if (entities.region || (entities.preferredCities && entities.preferredCities.length > 0)) secondaryIntents.push("city_filter");
    if (entities.hasStipend || entities.grantType) secondaryIntents.push("grant_filter");
    if (entities.direction) secondaryIntents.push("direction_filter");
    if (entities.englishLevel || entities.careerGoal || entities.accommodation) secondaryIntents.push("profile_update");

    // Step 4: If matched, return
    if (matchedIntent) {
      return {
        intent: matchedIntent as Intent,
        confidence: matchedConfidence,
        secondaryIntents: secondaryIntents.length > 0 ? secondaryIntents : undefined,
        entityConfidence: this.computeEntityConfidence(cleanMessage, message),
        entities,
      };
    }

    // Default to faq if message is long enough
    if (cleanMessage.length > 10) {
      return {
        intent: "faq",
        confidence: 0.5,
        entityConfidence: this.computeEntityConfidence(cleanMessage, message),
        entities,
      };
    }

    return {
      intent: "unknown",
      confidence: 0.3,
      entityConfidence: this.computeEntityConfidence(cleanMessage, message),
      entities,
    };
  }

  /**
   * CONFIDENCE SCORE (BOSQICH 7): entity'larning ishonch balini hisoblaydi.
   * Hozircha asosiy e'tibor direction da — detectDirectionWithConfidence orqali
   * (aniq so'z 0.92, kelishik 0.87). Boshqa entity'lar aniq regex orqali
   * topilgani uchun 1.0 (yuqori ishonch).
   *
   * MUHIM: bu funksiya detectDirectionWithConfidence() ni ishlatadi — bu
   * detectDirectionCategory()dan FARQLI funksiya (ishonch bali bilan qaytaradi),
   * shuning uchun classify() boshida hisoblangan `entities.direction` bilan
   * almashtirib bo'lmaydi — ular boshqa-boshqa ma'lumot qaytaradi.
   *
   * @param cleanMessage — normalizeUserText'dan o'tgan matn (classify uchun)
   * @param rawMessage   — asl foydalanuvchi xabari (typo aniqlash uchun)
   */
  private computeEntityConfidence(cleanMessage: string, rawMessage: string): Record<string, number> {
    const conf: Record<string, number> = {};

    const direction = detectDirectionWithConfidence(cleanMessage);
    if (direction) {
      conf.direction = direction.confidence;
      // Typo heuristikasi: normalizator tuzatadigan xato so'zlar (RAW matnda) ishonchni pasaytiradi.
      // Masalan "Tibiyot" → "tibbiyot", "Kompyutr" → "kompyuter", "Dasturlaw" → "dasturlash"
      // MUHIM: "yonalish" (apostrofsiz) typo EMAS — juda keng tarqalgan oddiy yozuv,
      // clarification qo'shilsa UX buziladi. Faqat HAQIQIY xato so'zlar hisobga olinadi.
      const rawLower = (rawMessage || "").toLowerCase();
      const hasNormalizedTypo = /\b(tibiyot|kompyutr|dasturchsi|dasturlaw|dasturci|daturchi|universitei|unversitet)\b/.test(rawLower);
      if (hasNormalizedTypo) {
        conf.direction = Math.min(conf.direction, 0.62);
      }
      // Qisqa/qisqartma so'zlar ("IT", "AI") — ularning o'zi qisqa, ishonch biroz past
      if (/\b(it|ai)\b/i.test(cleanMessage) && cleanMessage.trim().split(/\s+/).length <= 3) {
        conf.direction = Math.min(conf.direction, 0.72);
      }
    }

    return conf;
  }

  private extractEntities(message: string): IntentResult["entities"] {
    const entities: IntentResult["entities"] = {};

    // Extract university names (known abbreviations and full names)
    // MUHIM: TKXU, TKTU, SamDU kabi qisqartmalar ham bor
    const uniPatterns = [
      // Qisqartma + EGALIK/YO'NALISH qo'shimchalari: "PDPda", "EMUni",
      // "TATUning", "PDPga" — real foydalanuvchi suffix'li yozadi. \b faqat
      // so'z chegarasini tekshiradi, suffix esa qo'shimcha guruhda — match[1]
      // har doim sof qisqartma bo'lib qoladi ("PDPda" → match[1]="PDP").
      /\b(PDP|INHA|WIUT|TATU|TUIT|EMU|SamDU|ADU|MIS|MESI|TKXU|TKTU|TDTU|TDIU|TDYU|TTA|TTPI|TATI|SamSI|BuxDU|FarDU|NamDU|UrDU|QarDU|AndDU|TerDU|NavDPI|JDPU|TDPU|ToshDTU|ToshKEU|TMI|TQI|ToshFA|ToshSEI|TAFU|amity|westminster|inh[oa]|akfa\s*med(?:line)?)(?:ni|ning|ga|da|dan|dagi|sini|sining|dagi|lar|larining|larida|laridan|lariga)?\b/i,
    ];

    for (const pattern of uniPatterns) {
      const match = message.match(pattern);
      if (match) {
        entities.university = match[1].toUpperCase();
        break;
      }
    }

    if (!entities.university) {
      const universityPattern = /(.+?)\s+(universitet|universiteti|university|universitetning|universitetida|universitetidagi|institut|instituti|institutning|institutida|oliygoh|oliygohi|akademiya|akademiyasi|akademiyaning|akademiyada|akademiyadagi|kollej|kolleji)(da|dagi|ga|ni|ning|dan|si|sining)?(\s|$)/i;
      const universityMatch = message.match(universityPattern);

      if (universityMatch) {
        const candidate = `${universityMatch[1].trim()} ${universityMatch[2].trim()}`;
        const genericCategory = /^(davlat|xususiy|xalqaro|mahalliy)\s+(universitet|university|oliygoh|institut|akademiya|kollej)$/i;

        // Demonstrativ/umumiy so'zlar bilan boshlansa — university emas
        // ("shu universitet", "bu institut", "qaysi universitet" kabi follow-up'larda)
        const genericPrefix = /^(shu|bu|o'sha|qaysi|qanday|bitta|bir|mana|eng|boshqa|barcha|hamma|ko'p|yaxshi|arzon|davlat|xususiy|xalqaro|mahalliy|xorijiy|yangi|men|menga|meni|biz|bizga|ular|katta|kichik|kichikroq|eski|yangi)\b/i;
        // MUHIM (Fix): candidate ICHIDA aniqlash/so'roq so'zlari bo'lsa ham university EMAS!
        // "men tarix faniga qiziqaman lekin qanday universitet" — "qanday" o'rtada,
        // genericPrefix faqat BOSHIni tekshirgani uchun noto'g'ri university bo'lib qolardi.
        // "qaysi universitetni tanlasam", "nima universitet" kabi maslahat so'rovlarida
        // ham candidate ichida shu so'zlar bor — ular university nomi bo'la olmaydi.
        const hasQuestionWordInside =
          /\b(qanday|qaysi|qanaqa|nima|bilmayman|tanlasam|tanlashim|topishim|o'qishim|qayerda|qaerda)\b/i.test(candidate);

        // MUHIM (Fix: intent classification): candidate HAQIQIY universitet
        // nomiga o'xshashi shart! "salom. men bu yil imtihondan yiqildim,
        // lekin universitet" kabi BUTUN GAP nom sifatida qabul qilinmasligi
        // kerak — gap oxirida "universitet" so'zi bo'lsa ham (u so'z "da"
        // qo'shimchasi bilan "universitetda" bo'lib, regex'ga tushadi).
        //
        // Qoidalar:
        //   1) So'z soni ≤ 8 — eng uzun real nom: "Toshkent irrigatsiya va
        //      qishloq xo'jaligini mexanizatsiyalash muhandislari instituti"
        //   2) Gap tinish belgilari (.,!?;) bo'lmasligi — real nomlarda yo'q
        //   3) Nomda bo'lishi MUMKIN BO'LMAGAN so'zlar (olmoshlar, fe'llar,
        //      so'roq so'zlari, bog'lovchilar, salomlashish) bo'lmasligi
        const NOT_NAME_WORDS =
          /\b(men|mening|meni|menga|menimcha|biz|bizning|siz|sening|qilaman|qilmoqchi|qilyapman|bo'lmoqchiman|bo'lishni|yiqildim|yigilib|orzu|o'qishni|o'qishga|o'qishim|kirmoqchi|topshirmoqchi|kerak|lekin|ammo|chunki|uchun|bilan|salom|assalomu|hayrli|rahmat|qanday|qaysi|qanaqa|nima|nega|qachon|qayerda|qaerdadir|qayerga|bormi|mavjudmi|bor|yo'q|hozir|endi|yana|hamma|barcha|har|eng|juda|o'sha|shu|bu|haqida|ma'lumot|info|tavsiya|maslahat|tanla|tanlash|ko'rsat|ayt|ber|yordam|iltimos|kerakmi)\b/i;
        const hasSentencePunct = /[.,!?;:]/.test(candidate);
        const wordCount = candidate.trim().split(/\s+/).length;
        // MUHIM (reviewer fix): wordCount ≤ 10 — "O'zbekiston Respublikasi
        // Prezidenti huzuridagi Strategik va mintaqalararo tadqiqotlar instituti"
        // (9 so'z) kabi real nomlar o'tishi kerak. Bogus "salom. men bu yil
        // imtihondan yiqildim, lekin universitet" baribir NOT_NAME_WORDS
        // (men/yiqildim/lekin) va tinish belgisi orqali chiqarib tashlanadi.
        const looksLikeRealName =
          !NOT_NAME_WORDS.test(candidate) && !hasSentencePunct && wordCount <= 10;
        // STAGE 15f: "Toshkentda universitet", "Samarqanddagi institut" —
        // joy nomi + yalang'och universitеt so'zi NOM emas, LOKATSIYA filtri!
        // ("Toshkent axborot texnologiyalari universiteti" kabi REAL nomlarga
        // tegmaydi — ularda joy nomi orasida deskriptor bor).
        const locationOnly = /^(?:toshkent|samarqand|buxoro|andijon|namangan|farg'ona|fargana|qashqadaryo|qashqadarya|surxondaryo|surxondarya|xorazm|navoiy|jizzax|sirdaryo|qoraqalpog'iston|karakalpakstan)(?:da|dagi|dagi|ning|dagi|da)?\s+(?:universitet|oliygoh|institut|akademiya)$/i.test(candidate);
        if (!genericCategory.test(candidate) && !genericPrefix.test(candidate) && !hasQuestionWordInside && !locationOnly && looksLikeRealName) {
          entities.university = candidate;
        }
      }
    }

    // NEGATIV REFERENCE (STAGE 15e): "yo'q TATU emas", "TATU kerak emas",
    // "TATUni istamayman" — user universitеtni RAD etmoqda, entity saqlanmasligi
    // kerak (aks holda "yo'q TATU emas" TATU haqida qidiruvga aylanib qolardi).
    // Muhim: negativ fe'l universitеt nomidan KEYIN DARXOL kelishi shart
    // (orada boshqa so'z bo'lmasa) — "Yo'q, EMUni aytgandim" (repair) yoki
    // "PDPda xususiy emas" kabi holatlarga tegmaydi.
    if (entities.university) {
      const uniEsc = entities.university.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const uniNegReject = new RegExp(
        `\\b(?:${uniEsc})(?:ning|ni|ga|da|dan|dagi|sini|sining|lar|larining|larida|laridan|lariga|ning|ni)?\\s+(?:emas|kerak\\s+emas|keragi\\s+yo'q|istamayman|xohlamayman|bo'lsin\\s+emas)\\b`,
        "i"
      );
      if (uniNegReject.test(message)) {
        delete entities.university;
        console.log(`[UniNegation] universitеt rad etildi — entity o'chirildi: "${message.substring(0, 60)}"`);
      }
    }

    // Extract degree mentions — MUHIM (BOSQICH 3): egalik/ko'plik shakllari ham!
    // "bakalavrlari", "magistrlari", "doktoranturalari" kabi follow-up so'zlar
    // ham aniqlanishi kerak ("Toshkentdagi universitetlar → bakalavrlari").
    if (/\bbakalavr(?:lar|lari|ning|ni|ga|da|dan|larining)?\b/i.test(message) || /\bbachelor\b/i.test(message)) {
      entities.degree = "bachelor";
    }
    if (/\bmagistr(?:lar|lari|ning|ni|ga|da|dan|larining)?\b/i.test(message) || /\bmaster\b/i.test(message) || /\bmagistratura(?:lar|lari|ning|ni|ga|da|dan)?\b/i.test(message)) {
      entities.degree = "master";
    }
    if (/\bphd\b/i.test(message) || /\bdoktorantura(?:lar|lari|ning|ni|ga|da|dan)?\b/i.test(message)) {
      entities.degree = "phd";
    }

    // Extract region mentions
    const regions: Array<[RegExp, string]> = [
      // MUHIM (Fix 15): "toshkent" yolg'iz o'zi (recommendation dialog javobi)
      // → Toshkent shahri (14). Viloyat (11) uchun aniq "viloyat" so'zi kerak.
      [/(?:toshkent\s+viloyati|toshkent\s+viloyatida|toshkent\s+viloyatidagi|toshkent viloyati|toshkent viloyatida|toshkent viloyatidagi|toshkentdagi viloyat|toshkentda viloyat)/i, "11"],
      [/(?:toshkent|toshkenda|toshkentda|toshkent\s+shahri|toshkent\s+shahrida|toshkent\s+shahridagi|toshkent shahri|toshkent shahrida|toshkent shahridagi|toshkentdagi|toshkentga|toshkentdan|toshkentning|toshkendagi)/i, "14"],
      [/(?:qoraqalpog'iston|qoraqalpog'iston Respublikasi|nukus|qoraqalpog'iston viloyati)/i, "1"],
      [/(?:andijon|andijonda|andijondagi|andijon viloyati|andijon viloyatida)/i, "2"],
      [/(?:buxoro|buxoroda|buxorodagi|buxoro viloyati|buxoro viloyatida)/i, "3"],
      [/(?:jizzax|jizzaxda|jizzaxdagi|jizzax viloyati|jizzax viloyatida)/i, "4"],
      [/(?:qashqadaryo|qarshida|qarshidagi|qarshi|qarshi viloyati|qashqadaryo viloyati)/i, "5"],
      [/(?:navoiy|navoiyda|navoiydagi|navoiy viloyati)/i, "6"],
      [/(?:namangan|namanganda|namangandagi|namangan viloyati)/i, "7"],
      [/(?:samarqand|samarqandda|samarqanddagi|samarqand viloyati)/i, "8"],
      [/(?:surxondaryo|termiz|surxondaryoda|surxondaryodagi|surxondaryo viloyati)/i, "9"],
      [/(?:sirdaryo|guliston|sirdaryoda|sirdaryodagi|sirdaryo viloyati)/i, "10"],
      [/(?:farg'ona|fargona|fergana|farg'onada|farg'onadagi|fergona viloyati)/i, "12"],
      [/(?:xorazm|urganch|xorazmda|xorazmdagi|xorazm viloyati)/i, "13"],
    ];

    for (const [pattern, id] of regions) {
      if (pattern.test(message)) {
        entities.region = id;
        break;
      }
    }

    // Extract direction category mentions — sinonimlar modulidan foydalanamiz
    // (meditsina, vrach, shifokor, farmatsiya, davolash... barchasi shu yerda)
    // STAGE 17 (blind): yalang'och "ta'lim"/"maktab" pedagogika EMAS.
    // "bolam maktabni bitiradi" (maktabni TUGATISH), "kechki ta'lim" (ta'lim
    // SHAKLI) — pedagogika yo'nalishi emas. O'qituvchilik konteksti
    // ("o'qituvchi bo'lmoqchiman") yoki aniq pedagogika yo'nalishlari
    // ("maktabgacha ta'lim", "boshlang'ich ta'lim") saqlanadi.
    let detectedDirection = detectDirectionCategory(message);
    if (detectedDirection === "pedagogika") {
      const teacherContext = /\b(o'qituvchi|ustoz|pedagog|teacher|o'qitmoqchi|o'qitaman|o'qitish|dars\s+ber|maktabda\s+ishla|tarbiyachi|psixolog)\b/i.test(message);
      const compoundPedDir = /\b(maktabgacha|boshlang'ich\s+ta'lim|jismoniy\s+ta'lim|kasb\s+ta'limi?|maxsus\s+pedagogika|defektologiya|inkluziv|maktab\s+o'qituvchisi)\b/i.test(message);
      const bareEducationWord = !teacherContext && !compoundPedDir && /\b(?:ta'lim|talim|maktab)(?:da|dan|ning|ni|ga|i|ida|idagi|imiz|imizning)?\b/i.test(message);
      // STAGE 18 (blind): "ustozlari qanday/kim" — professorlar haqida SAVOL,
      // pedagogika yo'nalishi EMAS ("ustoz" sinonim bo'lsa ham).
      const facultyQuery = /\bustozlar(?:i|imiz)?\s+(qanday|kim|kimlar|bormi|soni)\b/i.test(message);
      if (bareEducationWord || facultyQuery) {
        detectedDirection = null;
        console.log(`[PedagFalsePositive] pedagogika konteksti yo'q → o'chirildi: "${message.substring(0, 60)}"`);
      }
    }
    // STAGE 18 (blind): "qishloqdan kelaman/qishloqda yashayman" — JOY kelib
    // chiqishi, qishloq xo'jaligi (agrar) yo'nalishi EMAS.
    if (detectedDirection === "qishloq") {
      const originContext = /\b(qishloqdan\s+(?:kelaman|man|keldim|bo'laman)|qishloqda\s+(?:yashayman|yashaymiz)|qishloqdanmiz|qishloq\s+joyida)\b/i.test(message);
      const agriContext = /\b(qishloq\s+xo'jaligi?|qishloq\s+xojaligi?|agrar|dehqonchilik|fermer)\b/i.test(message);
      if (originContext && !agriContext) {
        detectedDirection = null;
        console.log(`[QishloqFalsePositive] joy kelib chiqishi → agrar yo'nalish o'chirildi: "${message.substring(0, 60)}"`);
      }
    }
    // STAGE 18 (blind): "ingliz tili shart emas, rus tilida ham bo'ladi" — til
    // AFZALLIGI, filologiya yo'nalishi EMAS (filologiya sinonimlari orqali keladi).
    if (detectedDirection === "filologiya" && entities.language && !/\b(chet\s+tili|filolog|tilshunos|o'rganmoqchiman)\b/i.test(message)) {
      detectedDirection = null;
      console.log(`[LangFalsePositive] til afzalligi → filologiya o'chirildi: "${message.substring(0, 60)}"`);
    }
    if (detectedDirection) {
      entities.direction = detectedDirection;
    }

    // Extract language mentions — MUHIM (BOSQICH 3): egalik shakllari ham!
    // "inglizchasiga", "ingliz tilidagilari", "ruschasiga" kabi follow-up so'zlar.
    if (/\bingliz(?:cha|chasiga|chasida|chasini|da|dan|ga|ning|ni|lar|lari|larining)?\b/i.test(message) || /\benglish\b/i.test(message)) {
      entities.language = "english";
    }
    if (/\brus(?:cha|chasiga|chasida|chasini|da|dan|ga|ning|ni|lar|lari|larining)?\b/i.test(message) || /\brussian\b/i.test(message)) {
      entities.language = "russian";
    }
    if (/o'zbek(?:cha|chasiga|chasida|chasini|da|dan|ga|ning|ni|lar|lari|larining)?/i.test(message) || /\buzbek\b/i.test(message)) {
      entities.language = "uzbek";
    }
    // STAGE 18 (blind): "qoraqalpoq tilida o'qiydigan bormi" — til filtri
    if (/\bqoraqalpoq(?:cha|chasiga|chasida|chasini|da|dan|ga|ning|ni|lar|lari|larining|\s+tili|\s+tilida)?\b/i.test(message) || /\bkarakalpak\b/i.test(message)) {
      entities.language = "qoraqalpoq";
    }

    // Extract education type — MUHIM (BOSQICH 3): egalik/ko'plik shakllari ham!
    // "kunduzgilari", "sirtqilari", "masofaviylari" kabi follow-up so'zlar ham.
    // STAGE 18 (blind): "masofaviy o'qishni xohlamayman" — ta'lim shakli MENTION
    // qilingan, lekin rad etilgan → o'sha shakl qo'yilmaydi. Negativ FAQAT o'z
    // shakliga tegadi: "kunduzgi bo'lmasin, sirtqi qilaman" → part-time saqlanadi.
    const neg = (word: string) => new RegExp(`\\b${word}\\w*\\b[^.!?]{0,40}\\b(xohlamayman|istamayman|bo'lmasin|kerak\\s+emas|shart\\s+emas|keragi\\s+yo'q)\\b`, "i");
    if (/\bkunduzgi(?:lar|lari|ning|ni|ga|da|dan|larining)?\b/i.test(message) && !neg("kunduzgi").test(message)) entities.educationType = "full-time";
    if (/\bsirtqi(?:lar|lari|ning|ni|ga|da|dan|larining)?\b/i.test(message) && !neg("sirtqi").test(message)) entities.educationType = "part-time";
    if (/\bmasofaviy(?:lar|lari|ning|ni|ga|da|dan|larining)?\b/i.test(message) && !neg("masofaviy").test(message)) entities.educationType = "distance";

    // Extract institution category (3=davlat, 4=xususiy, 5=xalqaro)
    // MUHIM (BOSQICH 3): egalik/ko'plik shakllari ham! "davlatlari", "xususiylari",
    // "xalqarolari" kabi follow-up so'zlar ham kategoriyani anglatadi.
    // MUHIM (Fix): "davlat yoki xalqaro" kabi KOMBINATSIYALAR ham qo'llab-
    // quvvatlanadi — ilgari birinchi kategoriya (davlat) olinib, xalqarolar
    // (INHA, Amity, Turin...) filterdan chiqib ketardi.
    const catsFound: string[] = [];
    // MUHIM (Fix: stress test): "Davlatmi yoki xususiymi?" savolida "mi" so'roq
    // yuklamasi ham bor — "davlatmi", "xususiymi", "xalqaromi". Ilgari "mi"
    // ro'yxatda yo'q edi, shuning uchun "davlat" aniqlanmay, faqat "xususiy"
    // chiqardi. Endi ikkalasi ham topiladi → institutionCategories: ["3","4"].
    // MUHIM (Fix #40): "xususiylarini ko'rsat" — "larini" (ko'plik-egalik +
    // tushum) suffixi ham bor edi, faqat "larni" bor edi. "xususiylarni"
    // (larni) vs "xususiylarini" (larini) farqlanadi — ikkalasi ham qo'llab-
    // quvvatlanishi kerak.
    // MUHIM (Fix): "davlat imtihonlaridan o'tdim" — "davlat" so'zi imtihon
    // kontekstida institutionCategory EMAS! "davlat imtihoni" = state exam,
    // "davlat universiteti" emas. Yechim: "davlat imtihon/test/sinov"
    // birikmasini matndan olib tashlab, qolgan qismda "davlat" so'zini
    // qidiramiz — shunda "davlat imtihonlaridan o'tdim, davlat universitetiga
    // kirmoqchiman" dagi ikkinchi "davlat" (universitet konteksti) SAQLANADI.
    const messageWithoutStateExam = message.replace(/\bdavlat\s+imtihon(?:lar|laridan|idan|dan|ning|ni|ga)?\b/gi, " ");
    // SEMANTIC TRAP (STAGE 15c — user qoidasi): "davlat ... xohlardim/istardim,
    // lekin ... yetmadi/olmadi" — ERISHILMAGAN istak. User davlatga kirishni
    // XOHLAGAN, lekin balli yetmagan → bu institutionCategory EMAS (admissionFailed
    // konteksti, private-first kerak). Faqat AMALIY davlat istagi
    // ("tanlamoqchiman", "tavsiya qil", "kerak") kategoriya bo'ladi.
    // Misollar:
    //   "davlat universitetiga kirishni xohlardim, lekin ballim yetmadi" → davlat EMAS
    //   "davlat universitetini tanlamoqchiman" → davlat ✅ (amaliy)
    //   "davlatga kira olmadim, menga davlat universiteti tavsiya qil" → davlat ✅ (explicit talab)
    let messageForCat = messageWithoutStateExam;
    if (/\bdavlat\b[^.!?]{0,80}\b(xohlardim|istardim|xohlagan\s+edim|orzu\s+qilganman|orzu\s+qilardim|xohlayotgan\s+edim)\b[^.!?]{0,120}\b(lekin|biroq|ammo)\b[^.!?]{0,80}\b(yetmadi|yetmayapman|yetmagan|olmadi|olmadim|o'tolmadim|o'ta\s+olmadim|kira\s+olmadim|tusholmadim|chiqmadi)\b/i.test(messageWithoutStateExam)) {
      messageForCat = messageWithoutStateExam.replace(/\bdavlat\b/gi, " ");
      console.log(`[SemanticTrap] erishilmagan davlat istagi — kategoriya o'chirildi: "${message.substring(0, 70)}"`);
    }
    // NEGATIV DAVLAT ISTAGI (STAGE 15e): "davlat bo'lmasin", "davlat istamayman"
    // — davlat kategoriyasi EMAS. "davlat imtihonidan o'tdim" (fakt) yoki
    // "davlatga kira olmadim, menga davlat tavsiya qil" (explicit talab) kabi
    // holatlarga tegmaydi — negativ fe'l to'g'ridan-to'g'ri davlat istagiga
    // bog'langan bo'lishi kerak ("davlat ... bo'lmasin").
    // MUHIM: kategoriya tekshiruvidan OLDIN ishlashi kerak (aks holda davlat
    // allaqachon catsFound'ga qo'shilib qoladi).
    // STAGE 19 (fix): \bdavlat\w*\b — "davlatni xohlamayman" (tushum) kabi
    // suffix'li shakllar ham ushlanadi (ilgari \bdavlat\b "davlatni"ga
    // mos kelmas, kategoriya qolib ketardi).
    if (/\bdavlat\w*\b[^.!?]{0,50}\b(istamayman|xohlamayman|kerak emas|bo'lmasin|bo'lmas\b|shart emas|keragi yo'q)\b/i.test(messageForCat)) {
      messageForCat = messageForCat.replace(/\b(?:davlat|public|state)(?:lar|lari|larning|larining|larini|ning|ni|da|dan|dagi|ga|larida|laridan|lariga|lardan|lardagi|larni|larda|mi|mikin|niki)?\b/gi, " ");
    }
    // "niki" suffixi (Fix): "davlatniki", "xususiyniki" — egalik shakli
    // ("bu universitet davlatniki"). "davliniki" typo'si text-normalizer'da
    // "davlatniki"ga aylantiriladi.
    if (/\b(?:davlat|public|state)(?:lar|lari|larning|larining|larini|ning|ni|da|dan|dagi|ga|larida|laridan|lariga|lardan|lardagi|larni|larda|mi|mikin|niki)?\b/i.test(messageForCat)) {
      catsFound.push("3");
    }
    // NEGATIV ISTAK (STAGE 15c): "Xususiy universitet istamayman" — user
    // xususiy ISTAMAYapti, kategoriya EMAS. "istamayman/xohlamayman/yoqmaydi"
    // kontekstidagi xususiy chiqariladi. Amaliy istak ("xususiy kerak",
    // "xususiylardan qara") saqlanadi.
    //
    // STAGE 15e fix: negativ bo'lsa xususiyning HAMMA mention'i olib tashlanadi —
    // "Xususiy bo'lmasin, lekin yaxshi xususiy bo'lsa ko'rishim mumkin" kabi
    // gapda ikkinchi (ijobiy) xususiy mention'i qolib, noto'g'ri kategoriya
    // chiqmasligi kerak. Boshdagi "bo'lmasin" (rad etish) ustun turadi.
    let messageForXususiy = message;
    // STAGE 19 (fix): \bxususiy\w*\b — "xususiyni istamayman" kabi suffix'li
    // shakllar ham ushlanadi.
    if (/\bxususiy\w*\b[^.!?]{0,50}\b(istamayman|xohlamayman|yoqmaydi|kerak emas|istamayapman|bo'lmasin|bo'lmas\b|shart emas|keragi yo'q)\b/i.test(message)) {
      messageForXususiy = message.replace(/\b(?:xususiy|nodavlat|private)(?:lar|lari|larning|larining|larini|ning|ni|da|dan|dagi|ga|larida|laridan|lariga|lardan|lardagi|larni|larda|mi|mikin|niki)?\b/gi, " ");
    }
    if (/\b(?:xususiy|nodavlat|private)(?:lar|lari|larning|larining|larini|ning|ni|da|dan|dagi|ga|larida|laridan|lariga|lardan|lardagi|larni|larda|mi|mikin|niki)?\b/i.test(messageForXususiy)) {
      catsFound.push("4");
    }
    if (/\b(?:xalqaro|international)(?:lar|lari|larning|larining|ning|ni|da|dan|dagi|ga|larida|laridan|lariga|lardan|lardagi|larni|larda|mi|mikin|niki)?\b/i.test(message)) {
      catsFound.push("5");
    }
    if (catsFound.length > 1) {
      entities.institutionCategories = catsFound;
      entities.institutionCategory = catsFound[0];
    } else if (catsFound.length === 1) {
      entities.institutionCategory = catsFound[0];
    }

    // STAGE 17 (blind): KATEGORIYA BEFARQLIGI — "Xususiy ham davlat ham farqi
    // yo'q", "davlat yoki xususiy muhim emas" — user kategoriyaga BEFARQ →
    // institutionCategory UMUMAN qo'yilmaydi (har qanday kategoriya ochiq).
    // Aks holda "farqi yo'q" deganiga qaramay davlat+xususiy filter qo'yilib,
    // xalqaro universitеtlar ham chiqib ketardi.
    if (/\b(?:xususiy|davlat|xalqaro|nodavlat|private|state)\b[^.!?]{0,30}\b(farqi\s+yo'q|muhim\s+emas|ahamiyati\s+yo'q)\b/i.test(message) ||
        /\b(farqi\s+yo'q|muhim\s+emas)\b[^.!?]{0,30}\b(?:xususiy|davlat|xalqaro)\b/i.test(message)) {
      delete entities.institutionCategory;
      delete entities.institutionCategories;
      console.log(`[CatIndifference] kategoriya befarqligi → filter o'chirildi: "${message.substring(0, 60)}"`);
    }

    // Extract accommodation (yotoqxona) mention
    // STAGE 18 (blind): "yotoqxona bo'lmasa ham mayli", "yotoqxona kerak emas" —
    // mention qilingan, lekin talab EMAS (befarq/rad) → flag qo'yilmaydi.
    const accommodationMentioned = /\byotoqxona(li|si|sini|)?\b/i.test(message) || /\bakkomodatsiya\b/i.test(message) || /\baccommodation\b/i.test(message) || /\bdormitory\b/i.test(message) || /\bturar joy\b/i.test(message);
    const accommodationNegated = /\b(yotoqxona|akkomodatsiya|accommodation|dormitory|turar\s*joy)\w*\b[^.!?]{0,45}\b(kerak\s+emas|shart\s+emas|bo'lmasa\s+ham\s+mayli|bo'lmasa\s+mayli|bo'lmasa\s+ham\s+bo'ladi|bo'lmasa\s+bo'ldi|xohlamayman|istamayman|keragi\s+yo'q)\b/i.test(message);
    if (accommodationMentioned && !accommodationNegated) {
      entities.accommodation = "true";
    }

    // ---- Entity-First kengaytmalar (BOSQICH 1) ----
    // Byudjet: "20 mln gacha" → tuitionMax, "15 mln dan yuqori" → tuitionMin
    const budget = extractBudget(message);
    if (budget.tuitionMin) entities.tuitionMin = budget.tuitionMin;
    if (budget.tuitionMax) entities.tuitionMax = budget.tuitionMax;

    // Sof "X mln" ko'rinishi (gacha/dan yuqori yo'q) → tuitionMax sifatida
    // "Byudjetim 18 mln atrofida" → tuitionMax: 18000000
    // STAGE 15e: "oyiga 20 mln topaman" (OYLIK daromad) bu fallback'ga tushib
    // qolmasligi kerak — extractBudget bilan konsistent bo'lishi uchun.
    if (!entities.tuitionMax && !entities.tuitionMin && !/\b(oyiga|oylik|har\s+oy)\b/i.test(message)) {
      const approxBudget = message.match(/(\d+(?:[.,]\d+)?)\s*mln\b/i);
      if (approxBudget) {
        const val = parseFloat(approxBudget[1].replace(',', '.'));
        if (!isNaN(val)) entities.tuitionMax = Math.round(val * 1_000_000);
      }
    }

    // Fakultet: "stomatologiya fakulteti"
    const faculty = extractFaculty(message);
    if (faculty) entities.faculty = faculty;

    // Deadline: "deadline qachon", "hujjat topshirish muddati"
    const deadline = extractDeadline(message);
    if (deadline) entities.deadline = deadline;

    // Yangilik kategoriyasi: "grant yangiliklari"
    const newsCategory = extractNewsCategory(message);
    if (newsCategory) entities.newsCategory = newsCategory;

    // Stipendiya: "stipendiyali"
    const stipend = extractStipend(message);
    if (stipend !== undefined) entities.hasStipend = stipend;

    // ---- Profil kengaytmalar (YANGI) ----
    // Kasb maqsadi: "AI yordamida tibbiyotda ishlamoqchiman" → "ai_medicine"
    const careerGoal = extractCareerGoal(message);
    if (careerGoal) entities.careerGoal = careerGoal;

    // Ingliz darajasi: "C1", "IELTS 7", "B2"
    const englishLevel = extractEnglishLevel(message);
    if (englishLevel) entities.englishLevel = englishLevel;

    // Afzal shaharlar: "Toshkent yoki Samarqandni afzal ko'raman"
    const preferredCities = extractPreferredCities(message);
    if (preferredCities.length > 0) entities.preferredCities = preferredCities;

    // Xalqaro diplom, yotoqxona flaglari
    const goalFlags = extractUserGoalFlags(message);
    if (goalFlags.wantsInternational) entities.wantsInternational = true;
    if (goalFlags.wantsHostel) entities.accommodation = "true"; // mavjud field'ga qo'yiladi

    // AI + biomedical kontekst: direction override
    // "biologiya, kimyo va AI" → direction: biomedical (IT emas)
    if (!entities.direction && isAiBiomedicalContext(message)) {
      entities.direction = "biomedical";
    }

    return entities;
  }
}


export const intentClassifier = new IntentClassifier();