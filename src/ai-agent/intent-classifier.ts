import type { Intent, IntentResult } from "@/types";

export class IntentClassifier {
  private patterns: Record<Intent, RegExp[]> = {
    greeting: [
      /^(salom|assalomu alaykum|hayrli kun|hello|hi|hey|good morning|good evening|vaalom)\b/i,
    ],
    // comparison must come BEFORE university_search because it's more specific
    // "Solishtir" deyilganda university_search emas, comparison ishlashi kerak
    comparison: [
      /(solishtir|taqqosla|compare|comparison|farqi)/i,
      /(qaysi\s+(yaxshiroq|yaxshi|afzal|arzon|sifatli))/i,
      /\bvs\b|versus|\bva\s+\b.*\b(ning\s+farqi|solishtir)/i,
    ],
    // university_search NOW COMES BEFORE direction_search!
    // Sababi: "nechta universitet bor" deyilsa, AI model hallucination qiladi (55 ta dedi, aslida 152 ta).
    // university_search tool esa template response ishlatadi — u aniq ma'lumot beradi (overview cached data).
    // direction_search dan oldin tekshirilishi xavfsiz, chunki "SamDU da qanday yonalishlar bor" 
    // university_search patternlariga MOS KELMAYDI (yo'nalish so'zi yo'q).
    university_search: [
      /(necha|nechta|qancha|barcha|hamma|jami|umumiy|soni|sanoq|ro'yxati)\s+(universitet|oliygoh|institut)/i,
      /(universitet|oliygoh|institut)\s+(necha|nechta|qancha|bor|bormi|soni|ro'yxati|turlari|sanoq)/i,
      /(universitet|university|oliygoh|institut)\s+(haqida|ma'lumot|info)/i,
      /(qanday|qaysi)\s+(universitet|oliygoh)/i,
      /universitetlari?(ni|ning|lar)?\s+(ro'yxati|ko'rsat|top|ayt)/i,
      // Kategoriya bo'yicha: "xalqaro universitet", "davlat universitetlari"
      /(davlat|xususiy|xalqaro|private|public|state|international|nodavlat)\s+(universitet|oliygoh|institut)/i,
      // Shahar + bog'lovchi so'z + (kategoriya)? + universitet: "toshkent shahrida xalqaro universitetlar"
      // "shahrida" "shahridagi" "viloyatida" "viloyatidagi" "da" "dagi"
      /(toshkent|samarqand|buxoro|andijon|farg'ona|namangan|qarshi|urganch|nukus)(\s+\w+)?(da|dagi)?\s+(\w+\s+)?(universitet|oliygoh|institut)/i,
      // SUFFIX SUPPORT: "universitetlar bormi", "universitetlari bormi", "universiteti bormi"
      // MUHIM: faqat bormi/mavjudmi — necha/nechta/qancha yo'q!
      // Sababi: "... universiteti nechta yo'nalishi bor?" → university_search emas, direction_search!
      /(universitet|oliygoh|institut)(i|lar|lari|ni|ning|da|dan|ga|dagi|imiz)?\s+(bormi|mavjudmi|bormikan)/i,
      // "universitetlar", "universitetni" va h.k. + keyword
      /universitet\s+(necha|qancha)/i,
      /(ozbekistonda|o'zbekistonda|respublikada|mamlakatda)\s+(necha|nechta|qancha)\s+(universitet|oliygoh)/i,
      /universitetlar\s+(necha|nechta|qancha)/i,
      /(qanday)\s+(turlari|turi)\s+(bor|bormi)/i,
      /(viloyat|region|hudud)\s+(boyicha|buyicha)\s+(universitet)/i,
      // Aniq universitet nomi qatnashgan savollar (TKXU, Yodju, SamDU, Amity, WIUT va h.k.)
      // MUHIM: .* emas, .{0,50} — cheklangan masofa! Aks holda "Amity ... qanday yo'nalishlar"
      // kabi so'rovlar direction_search o'rniga university_search ga tushib ketadi!
      /\b(TKXU|TKTU|TDTU|TDIU|TDYU|SamDU|BuxDU|FarDU|NamDU|SamSI|TMI|TQI|ToshFA|ToshDTU|ToshKEU|TTA|TTPI|TATI|PDP|INHA|WIUT|Amity|Westminster|MDIS|TUIT|TATU|ADU|MIS|MESI|UrDU|QarDU|AndDU|TerDU|NavDPI|JDPU|TDPU|ToshSEI|TMCI)\b.{0,50}?(haqida|ma'lumot)/i,
      /(haqida|ma'lumot|qachon|tashkil|asos sol|ochilgan|hamkorlik|grant|kontrakt|narx|yotoqxona)\s+.*\b(universitet|oliygoh|institut)\b/i,
      // Universitet egalik/qaratqich kelishiklari bilan (universitetida, universitetning, universitetga)
      /\buniversiteti?(da|ning|ga|ni|dan|dagi)?\s+(haqida|ma'lumot|qachon|grant|bormi|yotoqxona|narx|kontrakt|hamkorlik|qanday|qayer|tashkil)/i,
      /\buniversiteti?(da|ning|ga|ni|dan|dagi)?\s+.*\s+(grant|kontrakt|narx|yotoqxona|hamkorlik)/i,
      // BARE UNIVERSITY NAME: "Toshkent arxitektura-qurilish universiteti" 
      // yoki "Amity universiteti" — hech qanday keyword YO'Q, faqat universitet nomi
      // MUHIM: bu pattern eng OXIRGI university_search patterni bo'lishi kerak!
      // Sababi: "nechta universitet" yoki "universitet bormi" kabi narsalarni 
      // yuqoridagi patternlar ushlaydi, bu pattern faqat bare namelar uchun.
      /[\w\s'-]+(?:universiteti?|instituti?|institut|oliygohi?|oliygoh)$/i,
    ],
    // direction_search handles specific field/study queries
    // MUHIM: word boundary (\b) ishlatiladi — "universitei" ichidagi "it" substringi 
    // direction_search ga tushib ketmasligi uchun!
    direction_search: [
      /(yo'nalish|yonalish|direction|mutaxassislik|dastur|program|kurs)/i,
      /qaysi\s+(yo'nalish|yonalish|fan|soha)/i,
      /(o'qish|o'qi)\s+(uchun|kerak|mumkin)/i,
      /\b(IT|dasturlash|injiniring|tibbiyot|iqtisod|pedagogika|huquq|biologiya|kimyo|fizika|matematika)\b/i,
      /(bakalavr|magistr|magistratura|doktorantura|phd)/i,
      /(kunduzgi|sirtqi|kechki|masofaviy)/i,
    ],
    // recommendation — "tavsiya qil", "qayerda o'qish kerak", "maslahat"
    recommendation: [
      /(tavsiya|maslahat|recommend|suggestion|tavsiya qil)/i,
      /(qaysi)\s+(universitet|yaxshi|afzal|yaxshiroq|tanlasam|tavsiya)/i,
      /(tanla|tanlash|tanlamoq|tanlov)/i,
      /(qayerda|qaerda|qayerga|qayerni)\s+(o'qish|o'qiy|o'qimoqchi|kirish|topish)/i,
      /(bilmayman|tushunmayapman|aniq emas|qaror qilolmay)/i,
      /(yaxshisi|eng yaxshi|eng ma'qul|optimal)/i,
      /(menga)\s+(universitet|yo'nalish|grant|ta'lim)\s+(top|tanla|tavsiya|ko'rsat|ber)/i,
      /(universitet|oqish joyi)\s+(tavsiya qil|tanla|top|kerak)/i,
    ],
    grant_search: [
      /(grant|stipendiya|scholarship|chegirma|diskont)/i,
      /(bepul|tekin|pulsiz|free)\s+(o'qish|ta'lim)/i,
      /(grant|scholarship)\s+(bor|bormi|mavjud)/i,
      /(100%|50%|foiz|percent)\s+(grant|chegirma)/i,
      /(IELTS|SAT)\s+(grant|stipendiya)/i,
    ],
    news_search: [
      /(yangilik|news|yangilangan|yangilanish|e'lon|xabar)/i,
      /(so'nggi|oxirgi|yangi|bugungi|yangiliklar)/i,
    ],
    admission: [
      /(qabul|admission|acceptance|hujjat|ro'yxatdan\s+o'tish)/i,
      /(qachon|muddat|deadline|start|tugash)\s+(qabul|admission)/i,
      /(ochiq|yopiq|davom|tugagan)(mi|midi)?\s*(qabul|admission)/i,
    ],
    transfer: [
      /(ko'chirish|transfer|o'tish|ko'chir|transferable)/i,
      /(bir\s+universitetdan|boshqa\s+universitetga)/i,
    ],
    faq: [
      /(qanday|qayerdan|qachon|kim|nima|necha|nima\s+uchun|how|what|when|where|why)/i,
    ],
    unknown: [],
  };

  /**
   * Matndagi keng tarqalgan xatolarni tuzatish (typo tolerance)
   * Masalan: "universitei" → "universiteti", "sharidan" → "shahridan"
   */
  /**
   * Matndagi keng tarqalgan xatolarni tuzatish (typo tolerance)
   * MUHIM: faqat ANIQ typolarni tuzatadi, to'g'ri so'zlarni buzmaydi!
   * Masalan: "universitei" → "universiteti", "sharidan" → "shahridan"
   */
  private normalizeText(text: string): string {
    let t = text.toLowerCase().trim();
    
    // universitet typolari (faqat aniq xatolar!)
    t = t.replace(/universitei/gi, 'universiteti');
    t = t.replace(/universitela/gi, 'universitetla');   // "universitelar" → "universitetlar"
    t = t.replace(/univers?ty/gi, 'university');       // "universty" → "university", "universiy" → "university"
    t = t.replace(/unversitet/gi, 'universitet');
    t = t.replace(/unniversitet/gi, 'universitet');
    t = t.replace(/univ\s+ersitet/gi, 'universitet');
    
    // ma'lumot typolari
    t = t.replace(/malumot/gi, "ma'lumot");           // "malumot" → "ma'lumot"
    
    // shahar typolari
    t = t.replace(/shax(ri|rida|ridagi)/gi, 'shah$1');   // "shaxri" → "shahri", "shaxrida" → "shahrida", "shaxridagi" → "shahridagi"
    t = t.replace(/shari?[dt]an/gi, 'shahridan');
    t = t.replace(/shardan/gi, 'shahridan');
    t = t.replace(/sh(a|ax)ridan/gi, 'shahridan');
    
    // yo'nalish typolari
    t = t.replace(/yonali?sh/gi, "yo'nalish");
    t = t.replace(/yonalis/gi, "yo'nalish");
    
    // qiziqish typolari
    t = t.replace(/qiziaman/gi, 'qiziqaman');
    
    // o'qish typolari
    t = t.replace(/oqish/gi, "o'qish");
    t = t.replace(/oqimoq/gi, "o'qimoq");

    // institut / instituti typo tolerance
    t = t.replace(/insituti/gi, 'institut');
    t = t.replace(/instituti/gi, 'institut');
    t = t.replace(/insitute/gi, 'institut');
    t = t.replace(/institution/gi, 'institut');

    // toshkent typolari
    t = t.replace(/toshkendan/gi, 'toshkentdan');   // "toshkendan" → "toshkentdan"

    return t;
  }

  classify(message: string): IntentResult {
    const cleanMessage = this.normalizeText(message);

    // Step 1: Check each intent pattern
    let matchedIntent: Intent | null = null;
    let matchedConfidence = 0.5;

    for (const [intent, patterns] of Object.entries(this.patterns)) {
      if (intent === "unknown") continue;

      for (const pattern of patterns) {
        if (pattern.test(cleanMessage)) {
          matchedIntent = intent as Intent;
          matchedConfidence = 0.8;
          break;
        }
      }
      if (matchedIntent) break;
    }

    // Step 2a: Override — agar message da direction keywords (yo'nalish, IT, dasturlash) bo'lsa
    // va university_search ga tushgan bo'lsa → direction_search ga o'tkazamiz!
    // Sababi: "Toshkent shahridagi Amity Universiteti IT ga qiziqaman" → shahar patterni
    // university_search ni trigger qiladi, lekin aslida direction_search kerak!
    if (matchedIntent === "university_search") {
      const hasDirectionKeyword = /\b(yo'nalish|dastur|IT\b|tibbiyot|iqtisod|pedagogika|huquq|muhandislik|muhandis|filologiya|san'at|sport|turizm|qishloq|bakalavr|magistratura|kunduzgi|sirtqi|kechki|masofaviy|mutaxassislik)\b/i.test(cleanMessage);
      if (hasDirectionKeyword) {
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
      const hasSpecificUni = this.extractEntities(cleanMessage).university !== undefined;
      if (hasUniKeyword || hasSpecificUni) {
        matchedIntent = "university_search";
        matchedConfidence = 0.85;
      }
    }



    // Step 3: If matched, return
    if (matchedIntent) {
      return {
        intent: matchedIntent,
        confidence: matchedConfidence,
        entities: this.extractEntities(cleanMessage),
      };
    }

    // Default to faq if message is long enough
    if (cleanMessage.length > 10) {
      return {
        intent: "faq",
        confidence: 0.5,
        entities: this.extractEntities(cleanMessage),
      };
    }

    return {
      intent: "unknown",
      confidence: 0.3,
      entities: {},
    };
  }

  private extractEntities(message: string): IntentResult["entities"] {
    const entities: IntentResult["entities"] = {};

    // Extract university names (known abbreviations and full names)
    // MUHIM: TKXU, TKTU, SamDU kabi qisqartmalar ham bor
    const uniPatterns = [
      /\b(PDP|INHA|WIUT|TATU|TUIT|SamDU|ADU|MIS|MESI|TKXU|TKTU|TDTU|TDIU|TDYU|TTA|TTPI|TATI|SamSI|BuxDU|FarDU|NamDU|UrDU|QarDU|AndDU|TerDU|NavDPI|JDPU|TDPU|ToshDTU|ToshKEU|TMI|TQI|ToshFA|ToshSEI|amity|westminster|inh[oa])\b/i,
    ];

    for (const pattern of uniPatterns) {
      const match = message.match(pattern);
      if (match) {
        entities.university = match[1].toUpperCase();
        break;
      }
    }

    if (!entities.university) {
      const universityPattern = /(.+?)\s+(universiteti?|university|institut|instituti|oliygoh|akademiya|kollej)(da|dagi|ga|ni|ning|dan)?(\s|$)/i;
      const universityMatch = message.match(universityPattern);

      if (universityMatch) {
        const candidate = `${universityMatch[1].trim()} ${universityMatch[2].trim()}`;
        const genericCategory = /^(davlat|xususiy|xalqaro|mahalliy)\s+(universitet|university|oliygoh|institut|akademiya|kollej)$/i;

        if (!genericCategory.test(candidate)) {
          entities.university = candidate;
        }
      }
    }

    // Extract degree mentions
    if (/\bbakalavr\b/i.test(message) || /\bbachelor\b/i.test(message)) {
      entities.degree = "bachelor";
    }
    if (/\bmagistr\b/i.test(message) || /\bmaster\b/i.test(message) || /\bmagistratura\b/i.test(message)) {
      entities.degree = "master";
    }
    if (/\bphd\b/i.test(message) || /\bdoktorantura\b/i.test(message)) {
      entities.degree = "phd";
    }

    // Extract region mentions
    const regions: Array<[RegExp, string]> = [
      [/(?:toshkent\s+shahri|toshkent\s+shahrida|toshkent\s+shahridagi|toshkent shahri|toshkent shahrida|toshkent shahridagi|toshkentdagi|toshkentda|toshkentga|toshkentdan)/i, "14"],
      [/(?:toshkent\s+viloyati|toshkent\s+viloyatida|toshkent\s+viloyatidagi|toshkent viloyati|toshkent viloyatida|toshkent viloyatidagi|toshkentdagi viloyat|toshkentda viloyat)/i, "11"],
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

    // Extract direction category mentions
    const directionPatterns: Array<[string, RegExp[]]> = [
      [
        'it',
        [
          /\bit\b/i,
          /dasturlash/i,
          /kompyuter/i,
          /axborot texnolog/i,
          /kiberxavfsizlik/i,
          /suniy intellekt/i,
          /data science/i,
          /software/i,
          /computer/i,
        ],
      ],
      [
        'tibbiyot',
        [
          /tibbiyot/i,
          /stomatolog/i,
          /farmatsevtika/i,
          /davolash/i,
          /klinik/i,
          /anesteziolog/i,
          /ginekolog/i,
          /shifokor/i,
        ],
      ],
      [
        'iqtisod',
        [
          /iqtisod/i,
          /moliya/i,
          /buxgalteriya/i,
          /bank/i,
          /marketing/i,
          /logistika/i,
          /finance/i,
          /economics/i,
        ],
      ],
      [
        'huquq',
        [
          /huquq/i,
          /yurisprudensiya/i,
          /advokat/i,
          /sud/i,
          /legal/i,
        ],
      ],
      [
        'pedagogika',
        [
          /pedagogika/i,
          /talim/i,
          /okituvchi/i,
          /maktabgacha/i,
          /defektolog/i,
        ],
      ],
      [
        'muhandislik',
        [
          /muhandislik/i,
          /engineering/i,
          /qurilish/i,
          /arxitektura/i,
          /energetika/i,
          /robot/i,
        ],
      ],
      [
        'filologiya',
        [
          /filologiya/i,
          /tilshunoslik/i,
          /lingvistika/i,
          /tarjima/i,
          /chet til/i,
        ],
      ],
      [
        'sanat',
        [
          /sanat/i,
          /dizayn/i,
          /moda/i,
          /musiqa/i,
          /kino/i,
          /teatr/i,
        ],
      ],
      [
        'sport',
        [
          /sport/i,
          /fizkultura/i,
          /trener/i,
          /olimpiya/i,
        ],
      ],
      [
        'turizm',
        [
          /turizm/i,
          /mehmondo['’]stlik/i,
          /hotel/i,
          /restoran/i,
        ],
      ],
      [
        'qishloq',
        [
          /qishloq/i,
          /dehqon/i,
          /agronomiya/i,
          /veterinar/i,
        ],
      ],
    ];

    for (const [category, patterns] of directionPatterns) {
      if (patterns.some((pattern) => pattern.test(message))) {
        entities.direction = category;
        break;
      }
    }

    // Extract language mentions
    if (/\bingliz\b/i.test(message) || /\benglish\b/i.test(message)) {
      entities.language = "english";
    }
    if (/\brus\b/i.test(message) || /\brussian\b/i.test(message)) {
      entities.language = "russian";
    }
    if (/o'zbek/i.test(message) || /\buzbek\b/i.test(message)) {
      entities.language = "uzbek";
    }

    // Extract education type
    if (/\bkunduzgi\b/i.test(message)) entities.educationType = "full-time";
    if (/\bsirtqi\b/i.test(message)) entities.educationType = "part-time";
    if (/\bmasofaviy\b/i.test(message)) entities.educationType = "distance";

    // Extract institution category (3=davlat, 4=xususiy, 5=xalqaro)
    if (/\bdavlat\b/i.test(message) || /\bpublic\b/i.test(message) || /\bstate\b/i.test(message)) {
      entities.institutionCategory = "3";
    } else if (/\bxususiy\b/i.test(message) || /\bprivate\b/i.test(message) || /\bnodavlat\b/i.test(message)) {
      entities.institutionCategory = "4";
    } else if (/\bxalqaro\b/i.test(message) || /\binternational\b/i.test(message)) {
      entities.institutionCategory = "5";
    }

    // Extract accommodation (yotoqxona) mention
    if (/\byotoqxona(li|si|sini|)?\b/i.test(message) || /\bakkomodatsiya\b/i.test(message) || /\baccommodation\b/i.test(message) || /\bdormitory\b/i.test(message) || /\bturar joy\b/i.test(message)) {
      entities.accommodation = "true";
    }

    return entities;
  }
}

export const intentClassifier = new IntentClassifier();
