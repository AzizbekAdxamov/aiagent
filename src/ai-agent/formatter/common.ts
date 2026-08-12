/**
 * FORMATTER LAYER (BOSQICH 7 — Formatter Layer)
 *
 * Umumiy yordamchi template'lar: greeting, API xatosi, fallback, thanks,
 * admission, generic clarification. Har bir intent o'z formatter modulida.
 *
 * Maqsad: provider-manager.ts dagi 700+ satrli getTemplateResponse ni
 * modullarga ajratish — har bir tool o'z faylida formatlanadi.
 */

/** Viloyat ID → nom (universitet va region template'larida ishlatiladi) */
export const REGION_NAMES: Record<number, string> = {
  1: 'Qoraqalpogiston Respublikasi', 2: 'Andijon viloyati', 3: 'Buxoro viloyati',
  4: 'Jizzax viloyati', 5: 'Qashqadaryo viloyati', 6: 'Navoiy viloyati',
  7: 'Namangan viloyati', 8: 'Samarqand viloyati', 9: 'Surxondaryo viloyati',
  10: 'Sirdaryo viloyati', 11: 'Toshkent viloyati', 12: "Farg'ona viloyati",
  13: 'Xorazm viloyati', 14: 'Toshkent shahri', 15: 'Boshqa',
};

export function getRegionName(id: number): string {
  return REGION_NAMES[id] || `Viloyat`;
}

/** Greeting template (intent=greeting yoki salomlashish so'zi) */
export function greetingResponse(language: string): string {
  if (language === "ru") {
    return `Здравствуйте! 😊 Я **Mentalaba AI** — помощник для студентов Узбекистана.

Я могу помочь вам с:

🏛 **Университеты** — государственные, частные и международные
📚 **Направления** — IT, медицина, экономика, педагогика и 50+ других

Какой у вас вопрос? Напишите, и я найду лучшие варианты для вас!`;
  }
  if (language === "en") {
    return `Hello! 😊 I'm **Mentalaba AI** — your assistant for students in Uzbekistan.

I can help you with:

🏛 **Universities** — state, private, and international universities
📚 **Programs** — IT, medicine, economics, pedagogy and 50+ more

What would you like to know? Write your question and I'll find the best options for you!`;
  }
  return `Assalomu alaykum! 😊 Men **Mentalaba AI** — O'zbekistondagi talabalar uchun yordamchi assistant.

Men sizga quyidagilarda yordam bera olaman:

🏛 **Universitetlar** — davlat, xususiy va xalqaro universitetlar haqida to'liq ma'lumot
📚 **Yo'nalishlar** — IT, tibbiyot, iqtisod, pedagogika va boshqa 50+ yo'nalish

Qaysi yo'nalish sizni qiziqtiradi? Qayerda o'qimoqchisiz? Savolingizni yozing, men sizga mos variantlarni topib beraman.`;
}

/** API/tool xatosi (401, timeout) uchun aniq javob — "topilmadi" bilan adashtirmaslik uchun */
export function apiErrorResponse(language: string): string {
  if (language === "ru") {
    return "К сожалению, не удалось получить данные из базы прямо сейчас. Попробуйте ещё раз чуть позже. 📌 [Mentalaba.uz](https://mentalaba.uz)";
  }
  if (language === "en") {
    return "Sorry, I couldn't reach the database right now. Please try again in a moment. 📌 [Mentalaba.uz](https://mentalaba.uz)";
  }
  return "Kechirasiz, hozircha ma'lumotlar bazasiga bog'lanishda xatolik yuz berdi. Iltimos, birozdan keyin qayta urinib ko'ring. 📌 [Mentalaba.uz](https://mentalaba.uz)";
}

/** Umumiy "topilmadi" fallback */
export function fallbackResponse(language: string): string {
  if (language === "ru") {
    return `Извините, не удалось найти эту информацию.

Попробуйте переформулировать вопрос, например:

- "Государственные университеты Ташкента"
- "IT направления"
- "Есть ли гранты"
- "Последние новости"

Расскажите, что вы ищете, и я помогу найти лучший вариант.

📌 [Mentalaba.uz](https://mentalaba.uz) — все возможности`;
  }
  if (language === "en") {
    return `Sorry, I couldn't find this information.

Try rephrasing your question, for example:

- "State universities in Tashkent"
- "IT programs"
- "Are there grants"
- "Latest news"

Or tell me what you're looking for and I'll help find the best option.

📌 [Mentalaba.uz](https://mentalaba.uz) — all opportunities`;
  }
  return `Kechirasiz, hozircha bu ma'lumotni topa olmadim.

Ehtimol, savolingizni boshqacha yozib ko'ring. Masalan:

- "Toshkentdagi davlat universitetlari"
- "IT yo'nalishlari"
- "Grantlar bormi"
- "So'nggi yangiliklar"

Yoki menga nima izlayotganingizni yozing, men sizga yordam beraman.

📌 [Mentalaba.uz](https://mentalaba.uz) — barcha imkoniyatlar`;
}

/**
 * GENERAL CHAT (intent=general_chat) — ruhiy qo'llab-quvvatlash / umumiy maslahat.
 * Tool chaqirilmaydi (handler=none) — bu oddiy suhbat javobi. LLM bo'lmasa ham
 * template shu yerda ishlaydi: insoniy, iliq, "topilmadi" demaydi.
 */
export function generalChatResponse(language: string): string {
  if (language === "ru") {
    return `Понимаю вас. 😊 Расскажите подробнее — я здесь, чтобы помочь.

Я могу помочь с выбором вуза, направлений, грантов и поступлением. Например:

- "Какие университеты в Ташкенте?"
- "IT направления"
- "Есть ли гранты?"

Если вы хотите поделиться своей ситуацией — я выслушаю и дам совет. Что вас беспокоит?`;
  }
  if (language === "en") {
    return `I hear you. 😊 Tell me more — I'm here to help.

I can help with university choices, programs, grants, and admissions. For example:

- "Which universities are in Tashkent?"
- "IT programs"
- "Are there grants?"

Or if you'd like to share your situation, I'll listen and give advice. What's on your mind?`;
  }
  return `Sizni tushunaman. 😊 Xavotir olmang — men shu yerdaman, yordam beraman.

Men sizga universitet tanlash, yo'nalishlar, grantlar va qabul jarayonida yordam bera olaman. Masalan:

- "Toshkentdagi qaysi universitetlar bor?"
- "IT yo'nalishlari"
- "Grantlar bormi?"

Yoki o'z vaziyatingizni ayting — eshitaman va maslahat beraman. Sizni nima qiynayapti?`;
}

/** Thanks / yakunlanish javobi */
export function thanksResponse(): string {
  return `Rahmat! 😊 Savolingiz bo'lsa, istalgan vaqtda yozing.

Yana qanday yordam kerak?

🏛 **Universitetlar** — qaysi universitet qiziqtiradi?
📚 **Yo'nalishlar** — qanday soha bo'yicha ma'lumot kerak?
💰 **Grantlar** — grantlar haqida bilmoqchimisiz?`;
}

/** Admission (qabul) — umumiy foydali javoblar */
export function admissionResponse(message: string): string {
  const lower = message.toLowerCase();

  if (/kirish\s*ball|o'tish\s*ball|ballari/.test(lower)) {
    return `### 📊 Kirish ballari

Kirish ballari **yo'nalish va universitetga qarab** farq qiladi. 🤔

Odatda:
• 🏛 **Davlat universitetlari** — yuqori raqobat, ballar 120-180 orasida
• 🏢 **Xususiy universitetlar** — ball talabi yumshoqroq
• 🌍 **Xalqaro universitetlar** — test/interview asosida

💡 **Aniq ballarni bilish uchun:**
1. Qaysi yo'nalish va universitet qiziqtiryapti — ayting, men o'sha univerni ko'rsataman
2. Har bir universitet kartasida qabul holati va kontrakt narxlari bor

📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha universitetlar

Qaysi yo'nalish sizni qiziqtiradi? 😊`;
  }
  if (/qanday\s+fan|qaysi\s+fan|fan\s+topshiraman/.test(lower)) {
    return `### 📚 Qabul fanlari

Qabul test sinovlari **3 tadan fan** bo'yicha o'tkaziladi:

🧮 **Majburiy fan:** O'zbekiston tarixi
➕ **2 ta ixtisoslik fani** (yo'nalishga qarab):

💻 **IT** → Matematika + Informatika
🏥 **Tibbiyot** → Biologiya + Kimyo
💰 **Iqtisod** → Matematika + Chet tili
⚖️ **Huquq** → Ingliz tili + Ona tili
📚 **Pedagogika** → Matematika + Ona tili

⚠️ Fanlar yo'nalish bo'yicha o'zgarishi mumkin — **aniq yo'nalish** aytsangiz, o'sha yo'nalishning fanlarini aytaman!

📌 **[Mentalaba.uz](https://mentalaba.uz/directions)** — barcha yo'nalishlar`;
  }
  if (/imtihon\s*(qachon|kuni|muddat|sanasi)?/.test(lower)) {
    return `### 🗓️ Imtihon vaqti

Qabul imtihonlari odatda **iyul-avgust oylarida** o'tkaziladi. 🎯

Ayni yilgi aniq sanalar va qabul muddatlari uchun: 

📌 **[Mentalaba.uz](https://mentalaba.uz/news)** — so'nggi qabul yangiliklari
📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — universitetlar

Qaysi universitet qiziqtirayotganini aytsangiz, uning qabul holatini ko'rsataman! 😊`;
  }
  if (/hujjat|qabul\s*qachon|qabul\s*boshlan/.test(lower)) {
    return `### 📋 Qabul jarayoni

O'zbekistonda qabul odatda quyidagi bosqichlarda o'tadi:

1️⃣ **Ro'yxatdan o'tish** — iyun-iyul oylarida (onlayn)
2️⃣ **Hujjatlar topshirish** — tanlangan universitetlar bo'yicha
3️⃣ **Test sinovlari** — iyul-avgust oylarida
4️⃣ **Natijalar e'lon** — avgust oyida
5️⃣ **Ro'yxatga kiritish** — sentabr oyida o'qish boshlanadi

⚠️ Aniq sanalar yil sayin o'zgaradi — **so'nggi e'lonlar** uchun: 

📌 **[Mentalaba.uz](https://mentalaba.uz/news)** — qabul yangiliklari

Qaysi universitet va yo'nalishga qiziqasiz? 😊`;
  }
  return `### 🎓 Qabul / kirish haqida

Men sizga quyidagilarda yordam bera olaman:

📊 **Kirish ballari** — "Kirish ballari qancha?"
📚 **Qabul fanlari** — "Qanday fan topshiraman?"
🗓️ **Imtihon vaqti** — "Imtihon qachon?"
📋 **Hujjat topshirish** — "Hujjatlarni qanday topshiraman?"

Shuningdek, ma'lum bir **universitetning qabul holati** (ochiq/yopiq) va kontrakt narxini ham aytib bera olaman — faqat university nomini yozing! 😊

📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha universitetlar`;
}

/** Generic clarification — "qaysi/tanlasam/bilmayman" kabi so'rovlar uchun */
export function genericClarificationResponse(language: string): string {
  if (language === "ru") {
    return `Понимаю! 😊 Давайте помогу найти лучший вариант. Ответьте на несколько вопросов:

1️⃣ **В каком городе или регионе хотите учиться?** (Ташкент, Самарканд, Бухара...)
2️⃣ **Какие направления вас интересуют?** (IT, медицина, экономика, педагогика, право...)
3️⃣ **Государственный или частный университет?**
4️⃣ **Грант интересует?**

На основе этих данных я порекомендую лучшие варианты! 🎯`;
  }
  if (language === "en") {
    return `I understand! 😊 Let me help you find the best option. Answer a few questions:

1️⃣ **Which city or region would you like to study in?** (Tashkent, Samarkand, Bukhara...)
2️⃣ **What field interests you?** (IT, medicine, economics, pedagogy, law...)
3️⃣ **State or private university?**
4️⃣ **Are you interested in grants?**

Based on this, I'll recommend the best options for you! 🎯`;
  }
  return `Tushunaman! 😊 Sizga mos variantni topishga yordam beraman. Keling, bir necha savolga javob bering:

1️⃣ **Qaysi shahar yoki viloyatda o'qimoqchisiz?** (Toshkent, Samarqand, Buxoro...)
2️⃣ **Qanday yo'nalishlarga qiziqasiz?** (IT, tibbiyot, iqtisod, pedagogika, huquq...)
3️⃣ **Davlatmi yoki xususiy universitetmi?**
4️⃣ **Grant qiziqtiradimi?**

Shu ma'lumotlar asosida sizga mos variantlarni tavsiya qilaman! 🎯`;
}

/**
 * FIELD CLARIFICATION (BOSQICH 12 — user qoidasi 8):
 * "Kontrakti qancha?", "Telefoni?" kabi BARE field so'rovida lastUniversity
 * YO'Q bo'lsa — tool taxmin qilmaydi, agent qaysi universitеt nazarda
 * tutilganini so'raydi. Aks holda barcha universitetlarning umumiy narxi/
 * telefoni chiqib ketardi.
 */
export function universityClarificationResponse(fieldLabel: string, language: string): string {
  if (language === "ru") {
    return `Какой университет вы имеете в виду? 🤔\n\nВы спросили про **${fieldLabel}**, но не указали конкретный вуз. Напишите название университета, например:\n\n- "TATU"\n- "PDP University"\n- "Тошкентская медицинская академия"\n\nЯ покажу нужную информацию! 😊`;
  }
  if (language === "en") {
    return `Which university do you mean? 🤔\n\nYou asked about **${fieldLabel}**, but didn't specify a particular university. Tell me the university name, e.g.:\n\n- "TATU"\n- "PDP University"\n- "Tashkent Medical Academy"\n\nI'll show the info you need! 😊`;
  }
  return `Qaysi universitеtni nazarda tutyapsiz? 🤔\n\nSiz **${fieldLabel}** haqida so'radingiz, lekin aniq universitеt nomini yozmadingiz. Iltimos, universitеt nomini ayting, masalan:\n\n- "TATU"\n- "PDP University"\n- "Toshkent tibbiyot akademiyasi"\n\nMen kerakli ma'lumotni ko'rsataman! 😊`;
}

/**
 * CONFIDENCE SCORE (BOSQICH 7 — Confidence): past ishonchli direction entity
 * bo'lsa, javob oxiriga aniqlashtiruvchi savol qo'shamiz.
 * "Kompyutr" → IT (confidence 0.61) → "«Kompyuter» yo'nalishini nazarda tutdingizmi?"
 */
export function appendLowConfidenceClarification(
  content: string,
  entities: { direction?: string; university?: string } | undefined,
  entityConfidence: Record<string, number> | undefined,
  language: string
): string {
  const conf = entityConfidence?.direction;
  if (conf === undefined || conf >= 0.7 || !entities?.direction) return content;

  const labels: Record<string, string> = {
    it: "IT",
    tibbiyot: "Tibbiyot",
    iqtisod: "Iqtisod",
    huquq: "Huquq",
    pedagogika: "Pedagogika",
    muhandislik: "Muhandislik",
    filologiya: "Filologiya",
    sanat: "San'at",
    sport: "Sport",
    qishloq: "Qishloq xo'jaligi",
    turizm: "Turizm",
  };
  const label = labels[entities.direction] || entities.direction;

  if (language === "ru") {
    return `${content}\n\n🤔 Небольшое уточнение: вы имели в виду направление **«${label}»**? Если другое — напишите, я найду нужное! 😊`;
  }
  if (language === "en") {
    return `${content}\n\n🤔 Quick check: did you mean the **«${label}»** field? If not — just tell me, and I'll find the right one! 😊`;
  }
  return `${content}\n\n🤔 Kichik aniqlik: siz **«${label}»** yo'nalishini nazarda tutdingizmi? Agar boshqasi bo'lsa — ayting, men topib beraman! 😊`;
}
