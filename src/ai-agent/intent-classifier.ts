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
    const STRONG_REC_SIGNALS = /\b(qaysi\s+(?:universitet(?:ni)?|yo'nalish(?:ni)?|oliygohni)\s+tanla|qaysi\s+biri\s+menga\s+(?:mos|yaxshiro?q|afzal)|tavsiya\s+(?:qil(?:ing)?|ber(?:ing)?)\b|tavsiya\s+(?:qil|ber)(?!gan|ingan|dilar|dik|di\b|ding|dingiz|gansiz|ganman|ganlar)\w*|eng\s+mos(?:ini)?|5\s+ta\s+variant|ustunlik(?:lari)?\s*(?:va|,)\s*kamchilik(?:lari)?|maslahat(?:ingiz)?\s+(?:bera|ber)|qaysi\s+(?:yo'nalish|kasb|soha)\s+(?:tanlasam|mos|kerak)|nima\s+tanlasam)\b/i;
    // Direction + maslahat so'rovi birga kelsa → recommendation. "Huquq
    // yo'nalishida o'qimoqchiman, qaysi universitet yaxshi" — yo'nalish
    // aniqlangan va user maslahat so'rayapti → recommendation. Lekin yalang'och
    // "qaysi universitet yaxshiroq" (direction YO'Q) comparison bo'lib qoladi.
    const hasDirAdviceSignal =
      !!detectedDirection &&
      /\bqaysi\s+[^,.;]{0,40}?(?:universitet|oliygoh)[^,.;]{0,30}?(?:o'qishim|o'qisam|o'qishni|topshirsam|kirsam|yaxshi|yaxshiroq|mos|afzal)\b/i.test(cleanMessage);
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
    const hasExplicitChoiceWord = /\b(tanlasam|tanlashim|tanlamoqchiman|tanlashni|tanlashga|tanlov|topishim|toplamoqchiman)\b/i.test(cleanMessage);
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
    const hasProfileContext = profileSignalCount >= 2;
    const hasOwnDirectionNow = !!detectedDirection;
    const isProfileRecommendation = hasOwnDirectionNow && hasProfileContext;
    const isAdviceRequest = hasExplicitChoiceWord || hasInterestWithConfusion || isProfileRecommendation;
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
      const hasDegreeOrET = entities.degree || entities.educationType || entities.language;
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
    const GENERAL_CHAT_NEGATIVE =
      /\b(maslahat|orzu\s+qilaman|imtihondan\s+yiqildim|yiqilib|afsus|depressiya|tushkunlik|ota-onam|motivatsiya|ruhiy|umidsiz|yig'layapman|yig'lab|nima\s+qilay|nima\s+qilaman|nima\s+qilishim|olmadim|kirmadim|hayot|hayotim|qo'rqaman|qiynalayapman|tushkun)\b/i;
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
    const isGeneralChat =
      isConversationalTarget &&
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
      /\b(PDP|INHA|WIUT|TATU|TUIT|SamDU|ADU|MIS|MESI|TKXU|TKTU|TDTU|TDIU|TDYU|TTA|TTPI|TATI|SamSI|BuxDU|FarDU|NamDU|UrDU|QarDU|AndDU|TerDU|NavDPI|JDPU|TDPU|ToshDTU|ToshKEU|TMI|TQI|ToshFA|ToshSEI|amity|westminster|inh[oa]|akfa\s*med(?:line)?)\b/i,
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
        const genericPrefix = /^(shu|bu|o'sha|qaysi|qanday|bitta|bir|mana|eng|boshqa|barcha|hamma|ko'p|yaxshi|arzon|davlat|xususiy|xalqaro|mahalliy|xorijiy|yangi|men|menga|meni|biz|bizga|ular)\b/i;
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
        if (!genericCategory.test(candidate) && !genericPrefix.test(candidate) && !hasQuestionWordInside && looksLikeRealName) {
          entities.university = candidate;
        }
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
    const detectedDirection = detectDirectionCategory(message);
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

    // Extract education type — MUHIM (BOSQICH 3): egalik/ko'plik shakllari ham!
    // "kunduzgilari", "sirtqilari", "masofaviylari" kabi follow-up so'zlar ham.
    if (/\bkunduzgi(?:lar|lari|ning|ni|ga|da|dan|larining)?\b/i.test(message)) entities.educationType = "full-time";
    if (/\bsirtqi(?:lar|lari|ning|ni|ga|da|dan|larining)?\b/i.test(message)) entities.educationType = "part-time";
    if (/\bmasofaviy(?:lar|lari|ning|ni|ga|da|dan|larining)?\b/i.test(message)) entities.educationType = "distance";

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
    if (/\b(?:davlat|public|state)(?:lar|lari|larning|larining|ning|ni|da|dan|dagi|ga|larida|laridan|lariga|mi|mikin)?\b/i.test(message)) {
      catsFound.push("3");
    }
    if (/\b(?:xususiy|nodavlat|private)(?:lar|lari|larning|larining|ning|ni|da|dan|dagi|ga|larida|laridan|lariga|mi|mikin)?\b/i.test(message)) {
      catsFound.push("4");
    }
    if (/\b(?:xalqaro|international)(?:lar|lari|larning|larining|ning|ni|da|dan|dagi|ga|larida|laridan|lariga|mi|mikin)?\b/i.test(message)) {
      catsFound.push("5");
    }
    if (catsFound.length > 1) {
      entities.institutionCategories = catsFound;
      entities.institutionCategory = catsFound[0];
    } else if (catsFound.length === 1) {
      entities.institutionCategory = catsFound[0];
    }

    // Extract accommodation (yotoqxona) mention
    if (/\byotoqxona(li|si|sini|)?\b/i.test(message) || /\bakkomodatsiya\b/i.test(message) || /\baccommodation\b/i.test(message) || /\bdormitory\b/i.test(message) || /\bturar joy\b/i.test(message)) {
      entities.accommodation = "true";
    }

    // ---- Entity-First kengaytmalar (BOSQICH 1) ----
    // Byudjet: "20 mln gacha" → tuitionMax, "15 mln dan yuqori" → tuitionMin
    const budget = extractBudget(message);
    if (budget.tuitionMin) entities.tuitionMin = budget.tuitionMin;
    if (budget.tuitionMax) entities.tuitionMax = budget.tuitionMax;

    // Sof "X mln" ko'rinishi (gacha/dan yuqori yo'q) → tuitionMax sifatida
    // "Byudjetim 18 mln atrofida" → tuitionMax: 18000000
    if (!entities.tuitionMax && !entities.tuitionMin) {
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