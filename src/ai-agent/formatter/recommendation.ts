/**
 * FORMATTER: recommend tool natijalarini formatlash.
 *  - needsClarification → savollar
 *  - needsClarification + cantAnswer → yo'nalishlar ro'yxati taklifi
 *  - recommendations → tavsiyalar + "nega aynan shu" tushuntirish
 */
import { lookupManager } from "@/data/lookups";

/**
 * STAGE 14g — VAZIYATGA MOS KIRISH: admissionFailed bo'lsa, clarification
 * "Qaysi shahar?" bilan boshlansa ham avval vaziyatga murojaat qilinadi:
 * "Siz imtihondan o'ta olmaganingizni aytdingiz. Avvalo xususiy va xalqaro
 * universitetlarni ko'rib chiqamiz..." — davlat/xususiy so'ralmaydi (tool-router
 * admissionFailedNoCategory bilan institutionCategory'ni missing ro'yxatidan
 * chiqarib yuborgan).
 */
function admissionContextIntro(profile: Record<string, any> | null | undefined, message?: string): string | null {
  // STAGE 15c (Response Quality): vaziyatga mos, qo'llab-quvvatlovchi kirish.
  // "### 🎯 Keling, birga topamiz!" marketing shabloni emas — userning holatiga
  // qarab tabiiy javob boshlanadi.
  // 1) Imtihondan yiqilgan (admissionFailed) — xususiy/xalqaro yo'l ochiq.
  if (profile?.admissionFailed) {
    return "Tushunaman, bu yil davlat imtihonidan o'ta olmaganingiz universitetda o'qish rejangizni to'xtatishi kerak degani emas. Avvalo xususiy va xalqaro universitetlarni ko'rib chiqish mumkin — ularning qabuli ko'pincha suhbat yoki test asosida o'tadi. ";
  }
  // 2) Imtihondan o'tgan / o'qishni xohlayotgan (wantsToStudy) — tanlashga
  // yordam berishga tayyormiz.
  if (profile?.wantsToStudy) {
    return "O'qishni davom ettirishni xohlaganingiz juda yaxshi — tanlashda sizga yordam berishga tayyorman. ";
  }
  // 3) Imtihondan O'TGAN, lekin qaysi yo'nalish/universitetni tanlashni
  // bilmaydi ("davlat imtihonlaridan o'tdim, qaysi universitet tanlashni bilmay
  // qoldim"). STAGE 15c: LLM provider limitda bo'lsa ham template fallback
  // tabiiy bo'ladi — "Keling, birga topamiz!" marketing shabloni emas.
  if (message && /\b(o'tdim|o'tganman|o'tkanman|utdim|utganman|o'tib\s+man)\b/i.test(message)) {
    return "Imtihonlardan muvaffaqiyatli o'tganingiz bilan tabriklayman — bu katta yutuq! Endi eng muhimi, sizga mos universitet va yo'nalishni birgalikda tanlash. ";
  }
  return null;
}

export function formatRecommend(firstResult: any, message: string, profile?: Record<string, any> | null): string {
  const data = firstResult.data;

  // Review fix: hard filter natijasida yo'nalish bo'yicha HECH QANDAY universitet
  // topilmagan (directionNotFound=true) — generic "topilmadi" o'rniga aniq
  // xabar: foydalanuvchi tanlagan yo'nalish bo'yicha univ yo'qligini aytamiz.
  if (data?.directionNotFound) {
    const dir = data.preferences?.directionCategory;
    let response = "Kechirasiz, hozircha ";
    response += dir
      ? `**"${dir}"** yo'nalishi bo'yicha mos universitet topilmadi.`
      : "sizning tanlovingizga mos universitet topilmadi.";
    response += " 😔\n\nBoshqa yo'nalish yoki shaharni sinab ko'ring, yoki yo'nalishlar katalogini ko'ring:\n\n📌 **[Mentalaba.uz](https://mentalaba.uz/directions)** — barcha yo'nalishlar";
    return response;
  }

  // Foydalanuvchi "bilmadim" desa — yana savol so'ramaymiz, yo'nalishlar ro'yxatini taklif qilamiz
  if (data?.needsClarification && data.cantAnswer) {
    let response = "### 🤔 Hechqisi yo'q, yordam beraman!\n\n";
    response += "Keling, qaysi soha sizga yaqinligini birgalikda aniqlaymiz.\n\n";
    response += "**Mana eng mashhur yo'nalishlar:**\n";
    response += "💻 **IT va dasturlash** — dasturchi, sun'iy intellekt, kiberxavfsizlik\n";
    response += "🏥 **Tibbiyot** — shifokor, stomatolog, farmatsevt\n";
    response += "💰 **Iqtisod va moliya** — iqtisodchi, bank ishi, buxgalter\n";
    response += "⚖️ **Huquq** — advokat, yurist, prokuror\n";
    response += "📚 **Pedagogika** — o'qituvchi, tarbiyachi\n";
    response += "🏗️ **Muhandislik** — qurilish, texnika, arxitektura\n";
    response += "🎨 **San'at** — dizayn, musiqa, rassomlik\n\n";
    response += "Yoki **qaysi fanlarni yaxshi ko'rasiz?** (matematika, biologiya, chet tili...) — shunga qarab ham tavsiya bera olaman! 😊\n\n";
    response += "📌 **[Mentalaba.uz](https://mentalaba.uz/directions)** — barcha yo'nalishlar katalogi";
    return response;
  }

  // Ma'lumot yetarli emas → savollar
  // SOFT CLARIFICATION (BOSQICH 14): interrogation EMAS — guided conversation.
  // 3 ta savolni birdan so'rash o'rniga FAQAT BIRINCHI yetishmayotgan ma'lumot
  // so'raladi. Foydalanuvchi javob bergach, recommendationProfile yig'iladi va
  // keyingi so'rovda NAVBATDAGI bitta savol so'raladi (zanjir davom etadi).
  if (data?.needsClarification) {
    const missing = data.preferences?.missing || [];
    if (missing.length === 0) {
      return "### 🎯 Keling, sizga mos variantni birga topamiz!\n\nKeling, savolga javob bering, men sizga mos variantlarni topib beraman! 😊";
    }

    // STAGE 14g: admissionFailed bo'lsa vaziyatga mos kirish — "Davlatmi yoki
    // xususiy?" hech qachon so'ralmaydi (private-first allaqachon qaror).
    // Savol vaziyatni tan olib beriladi: "Siz imtihondan o'ta olmaganingizni
    // aytdingiz — avvalo xususiy va xalqaro universitetlarni ko'rib chiqamiz.
    // Qaysi shaharda o'qimoqchisiz?"
    const intro = admissionContextIntro(profile, message);
    const first = missing[0];
    // STAGE 15c (Response Quality): vaziyatga mos intro BOR bo'lsa, marketing
    // shabloni ("### 🎯 Keling, sizga mos variantni birga topamiz!") qo'shilmaydi
    // — intro o'zi tabiiy boshlanish (user yiqilgan bo'lsa "tushunaman..." ruhida).
    // Intro bo'lmasagina umumiy sarlavha ishlatiladi.
    let response = intro
      ? `${intro}\n`
      : "### 🎯 Keling, sizga mos variantni birga topamiz!\n\n";
    if (first === 'region') {
      response += "1️⃣ **Qaysi shahar yoki viloyatda o'qimoqchisiz?** (Toshkent, Samarqand, Buxoro...)\n\n";
    } else if (first === 'directionCategory') {
      response += "2️⃣ **Qanday yo'nalish sizni qiziqtiradi?** (IT, tibbiyot, iqtisod, pedagogika, huquq...)\n\n";
      response += "Masalan: IT, tibbiyot, iqtisod, muhandislik, pedagogika, huquq...\n\n";
    } else if (first === 'institutionCategory') {
      // MUHIM (STAGE 14g): admissionFailed bo'lsa bu savol hech qachon
      // berilmaydi — private-first allaqachon qaror qilingan. Guard faqat
      // xavfsizlik uchun (tool-router buni missing'ga qo'shmagan bo'lsa ham).
      if (profile?.admissionFailed) {
        response += "3️⃣ **Qaysi shaharda o'qimoqchisiz?**\n\n";
      } else {
        response += "3️⃣ **Davlatmi yoki xususiy universitetmi?**\n\n";
      }
    }

    // STAGE 15c (Response Quality): intro bor bo'lsa, "Javob bering, men sizga
    // mos variantlarni topib beraman! 😊" marketing qatori qo'shilmaydi — intro
    // o'zi tabiiy yakun beradi. Intro bo'lmasa (oddiy holat) eski usul qoladi.
    response += intro
      ? ""
      : "📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha universitetlar\n\nJavob bering, men sizga mos variantlarni topib beraman! 😊";
    return response;
  }

  // Tavsiyalar topildi — Fix (ranking): backend qaror qilgan ENG MOS universitet
  // asosiy javob, qolganlari faqat oxirida "Keyingi alternativalar".
  if (data?.bestUniversity || data?.recommendations?.length > 0) {
    const prefs = data.preferences || {};
    const prefLines: string[] = [];
    if (prefs.region) {
      const rn = lookupManager?.getRegionName?.(parseInt(prefs.region), 'uz') || '';
      if (rn) prefLines.push(rn);
    }
    if (prefs.directionCategory) prefLines.push(prefs.directionCategory);
    if (prefs.institutionCategory) {
      const typeNames: Record<string, string> = { '3': '🏛 Davlat', '4': '🏢 Xususiy', '5': '🌍 Xalqaro' };
      prefLines.push(typeNames[prefs.institutionCategory] || '');
    }
    // MUHIM (Fix #42/#47/#60): user "Grant bo'lsa yaxshi" / "Yotoqxona kerak"
    // degan bo'lsa, javobda shu preference'lar ham ko'rsatilishi kerak — aks
    // holda javobda "grant"/"yotoqxona" so'zi umuman chiqmaydi (userning
    // so'rovi e'tiborsiz qolgandek tuyuladi).
    if (prefs.interestGrant) prefLines.push('💰 grant');
    if (prefs.interestAccommodation) prefLines.push('🏠 yotoqxona');

    const starsFor = (score: number): string => {
      const stars = Math.round(score / 20); // 0-5 yulduz
      return '⭐'.repeat(Math.max(1, Math.min(5, stars)));
    };
    const buildWhyParts = (uni: any): string[] => {
      const whyParts: string[] = [];
      // Backend hisoblagan score.reasons birinchi o'rinda (eng ishonchli).
      // STAGE 17: 5 taga ko'tarildi — yo'nalish/hudud/byudjet/qabul sabablari
      // bilan birga UNIVERSITET SIFATI sabablari (tajriba, talabalar soni,
      // akkreditatsiya) ham "Nega mos keladi?" qatorida ko'rinishi uchun.
      if (uni.score?.reasons?.length > 0) {
        whyParts.push(...uni.score.reasons.slice(0, 5));
      } else {
        if (prefs.directionCategory) whyParts.push(`📚 "${prefs.directionCategory}" yo'nalishi bor`);
        if (prefs.region && uni.location) {
          const rn = lookupManager?.getRegionName?.(parseInt(prefs.region), 'uz')?.replace(/ (viloyati|shahri)$/, '') || '';
          if (rn && uni.location.toLowerCase().includes(rn.toLowerCase())) whyParts.push(`📍 Aynan ${rn}da joylashgan`);
        }
      }
      const alreadyHas = (needle: string) => whyParts.some((p) => p.toLowerCase().includes(needle));
      const uniCat = (uni.type || uni.institutionCategory || '').toString().toLowerCase();
      // Fix: "davlat yoki xalqaro" (["3","5"]) tanlanganda ikkala mos tur ham
      // ko'rsatiladi (faqat birinchi emas).
      const prefCats = Array.isArray(prefs.institutionCategories) && prefs.institutionCategories.length > 0
        ? prefs.institutionCategories
        : (prefs.institutionCategory ? [prefs.institutionCategory] : []);
      const typeNames: Record<string, { needle: string; label: string }> = {
        '3': { needle: 'davlat', label: '🏛 Davlat universiteti' },
        '4': { needle: 'xususiy', label: '🏢 Xususiy universiteti' },
        '5': { needle: 'xalqaro', label: '🌍 Xalqaro universiteti' },
      };
      for (const cat of prefCats) {
        const t = typeNames[cat];
        if (t && uniCat.includes(t.needle) && !alreadyHas(t.needle)) whyParts.push(t.label);
      }
      // Fix (#42/#47/#60): user grant/yotoqxona so'ragan bo'lsa, univda bor/
      // yo'q bo'lishidan qat'i nazar javobda ko'rsatiladi ("❌ Grant mavjud
      // emas" ham — userning so'rovi e'tiborga olingani ko'rinadi).
      if (prefs.interestGrant) {
        if (uni.hasGrant) whyParts.push('💰 Grant imkoniyati bor');
        else if (!alreadyHas('grant')) whyParts.push('❌ Grant mavjud emas');
      } else if (uni.hasGrant && !alreadyHas('grant')) {
        whyParts.push('💰 Grant imkoniyati bor');
      }
      if (prefs.interestAccommodation) {
        if (uni.hasAccommodation) whyParts.push('🏠 Yotoqxonasi bor');
        else if (!alreadyHas('yotoqxona') && !alreadyHas('turar joy')) whyParts.push('❌ Yotoqxonasi yo\'q');
      } else if (uni.hasAccommodation && !alreadyHas('yotoqxona') && !alreadyHas('turar joy')) {
        whyParts.push('🏠 Yotoqxonasi bor');
      }
      return whyParts;
    };

    // Backend tanlagan eng mos universitet (qarorni LLM emas, backend chiqargan)
    const best = data.bestUniversity || data.recommendations[0];
    const alternatives = data.alternatives?.length > 0
      ? data.alternatives
      : (data.recommendations || []).slice(1);

    let response = "### 🎯 Sizga mos variantlar!\n\n";
    if (prefLines.filter(Boolean).length > 0) {
      response += `Sizning xohishingiz (${prefLines.filter(Boolean).join(', ')}) va vaziyatingizni hisobga olib, quyidagi variantlarni tavsiya qilaman: 👇\n\n`;
    }

    // === ASOSIY JAVOB: eng yuqori ball olgan universitet ===
    const bestIcons = `${best.hasGrant ? '💰' : ''}${best.hasAccommodation ? '🏠' : ''}`.trim();
    response += `**${best.fullNameUz || best.fullNameEn}** ${bestIcons ? bestIcons : ''}\n`;
    if (best.score?.total !== undefined) {
      response += `   🏆 *Ball: ${best.score.total}/100* ${starsFor(best.score.total)}\n`;
    }
    if (best.location) response += `   📍 *${best.location}*\n`;
    if (best.tuition && best.tuition !== 'N/A') response += `   💵 *${best.tuition}*\n`;
    const whyBest = buildWhyParts(best);
    if (whyBest.length > 0) {
      response += `   ✅ *Nega mos keladi:* ${whyBest.join(', ')}\n`;
    }
    if (best.score?.nuances?.length > 0) {
      response += `   ⚠️ *E'tibor berish kerak:* ${best.score.nuances.slice(0, 2).join('; ')}\n`;
    }
    if (best.slug) response += `   [🔍 Mentalaba.uz da ko'rish](https://mentalaba.uz/universities/${best.slug})\n`;
    if (best.descriptionUz) {
      const shortDesc = best.descriptionUz.substring(0, 150) + (best.descriptionUz.length > 150 ? '...' : '');
      response += `   ${shortDesc}\n`;
    }

    // === KEYINGI ALTERNATIVALAR (qisqa ro'yxat) ===
    if (alternatives.length > 0) {
      response += `\n**Keyingi alternativalar:**\n`;
      alternatives.forEach((uni: any, i: number) => {
        const icons = `${uni.hasGrant ? '💰' : ''}${uni.hasAccommodation ? '🏠' : ''}`.trim();
        const scoreStr = uni.score?.total !== undefined ? ` (${uni.score.total} ball ${starsFor(uni.score.total)})` : '';
        const whyAlt = buildWhyParts(uni);
        response += `${i + 1}. **${uni.fullNameUz || uni.fullNameEn}**${icons ? ` ${icons}` : ''}${scoreStr}`;
        if (uni.location) response += ` — ${uni.location}`;
        if (uni.tuition && uni.tuition !== 'N/A') response += `, ${uni.tuition}`;
        if (whyAlt.length > 0) response += ` — ${whyAlt[0]}`;
        if (uni.slug) response += ` ([ko'rish](https://mentalaba.uz/universities/${uni.slug}))`;
        response += `\n`;
      });
    }

    if (data.directions?.length > 0) {
      response += `**📚 Topilgan yo'nalishlar:** ${data.directions.length} ta\n`;
      data.directions.slice(0, 8).forEach((d: any, i: number) => {
        response += `${i + 1}. ${d.nameUz || d.nameEn} — ${d.universityName}\n`;
      });
      response += `\n`;
    }

    if (data.grants?.length > 0) {
      response += `**💰 Grantlar:** ${data.grants.length} ta topildi!\n`;
      data.grants.slice(0, 3).forEach((g: any) => {
        response += `- ${g.grantTitleUz || g.grantTitleEn}\n`;
      });
      response += `\n`;
    }

    response += `📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha universitetlar katalogi\n\nQaysi biriga batafsil qarashni xohlaysiz? 😊`;
    return response;
  }

  return "Kechirasiz, sizning talabingizga mos universitet topilmadi. 😔 Iltimos, boshqa parametrlarni tanlab ko'ring.";
}
