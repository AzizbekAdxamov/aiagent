/**
 * FORMATTER: search_university tool natijalarini formatlash.
 *
 * Holatlar:
 *  1. Region overview (region bo'yicha so'ralganda)
 *  2. Category overview (xususiy/davlat/xalqaro, regionsiz)
 *  3. National overview (umumiy savol)
 *  4. Single university (1 ta natija)
 *  5. List (2+ ta)
 *  6. Empty → fallback
 */
import { getRegionName } from "./common";
import { detectRequestField, type RequestField } from "../request-field";

export function formatUniversitySearch(firstResult: any, message: string): string {
  const isOverviewFormat = !Array.isArray(firstResult.data) && firstResult.data?.universityOverview;
  const overview = isOverviewFormat ? firstResult.data.universityOverview : null;
  const regionOverview = isOverviewFormat ? firstResult.data.regionOverview : null;
  const data = isOverviewFormat
    ? (Array.isArray(firstResult.data.universities) ? firstResult.data.universities : [])
    : (Array.isArray(firstResult.data) ? firstResult.data : [firstResult.data]);

  const isEmpty = data.length === 0;

  // ---------- 1. REGION OVERVIEW ----------
  if (regionOverview?.regionSpecific) {
    const rn = getRegionName(regionOverview.regionId);
    const rs = regionOverview.regionSpecific;

    const msgLower = message.toLowerCase();
    const askedInternational = /\bxalqaro\b/i.test(msgLower);
    const askedState = /\bdavlat\b/i.test(msgLower);
    const askedPrivate = /\bxususiy\b/i.test(msgLower);
    const askedYesNo = /\b(bormi|bormikan|mavjudmi)\b/i.test(msgLower);

    // Fix: "davlat yoki xalqaro" kabi BIR NECHTA kategoriya so'ralganda
    // bittasini emas, barchasini birlashtirib ko'rsatamiz ("Davlat va xalqaro").
    const askedCats: string[] = [];
    if (askedState) askedCats.push('davlat');
    if (askedPrivate) askedCats.push('xususiy');
    if (askedInternational) askedCats.push('xalqaro');
    const askedCategory = askedCats.length === 1 ? askedCats[0] : null;
    const categoryCount = askedCategory === 'xalqaro' ? rs.international
      : askedCategory === 'davlat' ? rs.state
      : askedCategory === 'xususiy' ? rs.private : rs.total;
    const categoryLabel = askedCategory || 'universitet';
    const categoryIcon = askedCategory === 'xalqaro' ? '🌍' : askedCategory === 'davlat' ? '🏛' : askedCategory === 'xususiy' ? '🏢' : '🏛';
    const multiLabel = askedCats.length > 1 ? askedCats.join(' va ') : null;
    // Ko'plik qo'shimchasi: "Davlat va xalqaro" → "Davlat va xalqaro" (allaqachon to'g'ri)
    const multiCount = askedCats.reduce((sum: number, c: string) =>
      sum + (c === 'xalqaro' ? rs.international : c === 'davlat' ? rs.state : c === 'xususiy' ? rs.private : 0), 0);

    let response = '';
    if (askedYesNo) {
      const cnt = multiLabel ? multiCount : categoryCount;
      const lbl = multiLabel ? multiLabel : categoryLabel;
      response = `Ha, ${rn}da **${cnt} ta** ${lbl} universitet bor! 🎉\n\n`;
    } else if (multiLabel) {
      response = `🏛 **Mana ${rn}dagi ${multiLabel} universitetlar ro'yxati:**\n\n`;
      response += `**${multiLabel.toUpperCase()} universitetlar:** ${multiCount} ta\n`;
    } else if (askedCategory) {
      response = `${categoryIcon} **Mana ${rn}dagi ${categoryLabel} universitetlar ro'yxati:**\n\n`;
    } else {
      response = `### 🏛 ${rn} universitetlari\n\n${rn}da jami **${rs.total} ta** universitet mavjud! 🎉\n\n`;
    }

    if (!askedCategory && !multiLabel) {
      response += `**Turlari bo'yicha:**\n`;
      response += `🏛 **Davlat:** ${rs.state} ta\n`;
      response += `🏢 **Xususiy:** ${rs.private} ta\n`;
      if (rs.international > 0) response += `🌍 **Xalqaro:** ${rs.international} ta\n`;
    } else if (askedCategory && categoryCount > 0) {
      response += `${categoryIcon} **${categoryLabel} universitetlar:** ${categoryCount} ta\n`;
    }

    if (data.length > 0) {
      response += `\n**Ro'yxat:**\n`;
      data.slice(0, 10).forEach((uni: any, i: number) => {
        const icons = `${uni.hasGrant ? '💰' : ''}${uni.hasAccommodation ? '🏠' : ''}`.trim();
        response += `${i + 1}. **${uni.fullNameUz || uni.fullNameEn}** ${icons ? icons : ''}\n`;
        if (uni.slug) response += `   [🔍 Mentalaba.uz da ko'rish](https://mentalaba.uz/universities/${uni.slug})\n`;
      });
    }

    if (askedCategory && data.length > 0) {
      response += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha universitetlar katalogi\n\n😊 Qanday yo'nalishga qiziqasiz? (IT, tibbiyot, iqtisod, pedagogika...)`;
    } else if (data.length > 0) {
      response += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha ${rs.total} ta universitet katalogi\n\n😊 Yuqoridagi universitetlardan qaysi biri haqida batafsil ma'lumot olishni xohlaysiz?`;
    } else {
      response += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha universitetlar katalogi\n\nYana qanday yordam kerak? 😊`;
    }
    return response;
  }

  // ---------- 2. CATEGORY OVERVIEW ----------
  const msgLowerCat = message.toLowerCase();
  const catInternational = /\bxalqaro\b/i.test(msgLowerCat);
  const catState = /\bdavlat\b/i.test(msgLowerCat);
  const catPrivate = /\bxususiy\b/i.test(msgLowerCat) || /\bnodavlat\b/i.test(msgLowerCat);
  const askedCategoryOnly = (catInternational || catState || catPrivate) && overview && !regionOverview;

  if (askedCategoryOnly) {
    // Fix: "davlat yoki xalqaro" kabi bir nechta kategoriya birga so'ralganda
    // barchasi ko'rsatiladi (faqat birinchi emas).
    const catNames: Record<string, { label: string; icon: string; count: number }> = {
      'davlat': { label: 'davlat', icon: '🏛', count: overview.categories.state },
      'xususiy': { label: 'xususiy', icon: '🏢', count: overview.categories.private },
      'xalqaro': { label: 'xalqaro', icon: '🌍', count: overview.categories.international },
    };
    const askedCatTypes: string[] = [];
    if (catState) askedCatTypes.push('davlat');
    if (catPrivate) askedCatTypes.push('xususiy');
    if (catInternational) askedCatTypes.push('xalqaro');
    const catType = askedCatTypes.length === 1 ? askedCatTypes[0] : null;
    const multiCats = askedCatTypes.length > 1
      ? askedCatTypes.map((c) => catNames[c].label).join(' va ')
      : null;
    const multiCount = askedCatTypes.reduce((s: number, c: string) => s + catNames[c].count, 0);
    const catIcons: Record<string, string> = { 'xalqaro': '🌍', 'davlat': '🏛', 'xususiy': '🏢' };
    const catCounts: Record<string, number> = {
      'xalqaro': overview.categories.international,
      'davlat': overview.categories.state,
      'xususiy': overview.categories.private,
    };
    const count = catType ? catCounts[catType] : multiCount;
    const icon = catType ? catIcons[catType] : '🏛';

    // "davlat va xalqaro" → "Davlat va xalqaro" (faqat birinchi so'z bosh harf)
    const catHeading = multiCats
      ? multiCats.charAt(0).toUpperCase() + multiCats.slice(1)
      : (catType === 'xalqaro' ? 'Xalqaro' : catType === 'davlat' ? 'Davlat' : 'Xususiy');
    const catLabel = multiCats || catType || 'universitet';
    let response = `## ${icon} ${catHeading} universitetlar\n\n`;
    response += `O'zbekistonda jami **${count} ta** ${catLabel} universitet bor! 🎉\n\n`;

    if (data.length > 0) {
      response += `**Masalan:**\n`;
      data.slice(0, 3).forEach((uni: any) => {
        response += `• **${uni.fullNameUz || uni.fullNameEn}**`;
        if (uni.location) response += ` — ${uni.location}`;
        response += '\n';
      });
      response += '\n';
    }

    response += `📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha ${catLabel} universitetlar katalogi\n\nSizga qaysi shahardan kerak yoki qanday yo'nalishga qiziqasiz? 😊`;
    return response;
  }

  // ---------- 3. NATIONAL OVERVIEW ----------
  const isGeneralQuery = !isEmpty && overview && !regionOverview;
  if (isGeneralQuery) {
    return formatOverview(overview);
  }

  // ---------- 4. SINGLE UNIVERSITY ----------
  if (!isEmpty) {
    if (data.length === 1) {
      // BOSQICH 12 (Response Composer): "PDP telefoni?" → faqat telefon.
      // Field so'ralgan bo'lsa (kontrakt/narx/yotoqxona/grant/qabul/sayt/
      // manzil/yo'nalishlar) to'liq karta EMAS, aynan shu maydon chiqariladi.
      const field = detectRequestField(message);
      if (field && field !== "summary") {
        return formatUniversityField(data[0], field);
      }
      return formatSingleUniversity(data[0]);
    }

    // ---------- 5. LIST ----------
    let response = "### 🏛 Universitetlar ro'yxati\n\n";
    response += "Mana sizga mos keladigan universitetlar:\n\n";
    data.slice(0, 10).forEach((uni: any, i: number) => {
      const icons = `${uni.hasGrant ? '💰' : ''}${uni.hasAccommodation ? '🏠' : ''}`.trim();
      response += `${i + 1}. **${uni.fullNameUz || uni.fullNameEn}** ${uni.location ? `— ${uni.location}` : ''} ${icons ? icons : ''}\n`;
      if (uni.slug) {
        response += `   [🔍 Mentalaba.uz da ko'rish](https://mentalaba.uz/universities/${uni.slug})\n`;
      }
    });
    response += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha ${data.length} ta universitetlar katalogi\n\nQaysi biriga batafsil qarashni xohlaysiz? 😊`;
    return response;
  }

  // ---------- 6. EMPTY (overview bo'lsa) ----------
  if (overview) {
    return formatOverview(overview);
  }

  return `Kechirasiz, sizning so'rovingiz bo'yicha universitet topilmadi. 😔\n\nIltimos, boshqa shartlar yoki hudud bo'yicha qidirib ko'ring.\n\n📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha universitetlar katalogi\n\nYana qanday yordam kerak? 😊`;
}

/** Milliy overview — "nechta universitet bor?" */
export function formatOverview(overview: any): string {
  let response = `### 🏛 O'zbekistondagi universitetlar\n\n`;
  response += `Jami **${overview.totalCount} ta** universitet mavjud! 🎉\n\n`;
  response += `**Turlari bo'yicha:**\n`;
  response += `🏛 **Davlat universitetlari:** ${overview.categories.state} ta\n`;
  response += `🏢 **Xususiy universitetlar:** ${overview.categories.private} ta\n`;
  response += `🌍 **Xalqaro universitetlar:** ${overview.categories.international} ta\n`;
  if (overview.universityExamples?.length) {
    response += `\n**Masalan:**\n`;
    overview.universityExamples.slice(0, 6).forEach((ex: any) => {
      const icon = ex.type === 'davlat' ? '🏛' : ex.type === 'xususiy' ? '🏢' : '🌍';
      response += `${icon} [${ex.name}](https://mentalaba.uz/universities/${ex.slug}) — ${ex.type}\n`;
    });
  }
  response += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha ${overview.totalCount} universitet katalogi\n\nYana qanday yordam kerak? Masalan, ma'lum bir shahar yoki yo'nalish bo'yicha universitetlarni ko'rishni xohlaysizmi? 😊`;
  return response;
}

/** Bitta universitet — batafsil karta */
export function formatSingleUniversity(uni: any): string {
  const slug = uni.slug || '';
  let response = `## 🏛 ${uni.fullNameUz || uni.fullNameEn}\n\n`;
  response += `${uni.descriptionUz ? uni.descriptionUz.substring(0, 300) : ''}\n\n`;
  response += `**📋 Asosiy ma'lumotlar:**\n`;
  if (uni.institutionCategory) response += `• **Turi:** ${uni.institutionCategory}\n`;
  if (uni.location) response += `• **Manzil:** ${uni.location}\n`;
  if (uni.foundedYear) response += `• **Tashkil etilgan:** ${uni.foundedYear}\n`;
  if (uni.studentsCount) response += `• **Talabalar soni:** ~${Math.round(uni.studentsCount / 1000)}k\n`;
  if (uni.directionCount) response += `• **📚 Yo'nalishlar soni:** ${uni.directionCount} ta\n`;
  if (uni.hasGrant !== undefined) response += `${uni.hasGrant ? '✅' : '❌'} **Grant:** ${uni.hasGrant ? 'Mavjud' : "Yo'q"}\n`;
  if (uni.tuition && uni.tuition !== 'N/A') response += `💰 **To'lov:** ${uni.tuition}\n`;
  if (uni.hasAccommodation !== undefined) response += `${uni.hasAccommodation ? '✅' : '❌'} **Yotoqxona:** ${uni.hasAccommodation ? 'Bor' : "Yo'q"}\n`;
  if (uni.phone) response += `📞 **Telefon:** ${uni.phone}\n`;
  if (uni.website) response += `🌐 **Sayt:** ${uni.website}\n`;
  if (uni.educationTypes?.length > 0) response += `🎓 **Ta'lim shakllari:** ${uni.educationTypes.map((e: any) => e.name).join(', ')}\n`;
  if (uni.degrees?.length > 0) response += `📜 **Darajalar:** ${uni.degrees.map((d: any) => d.name).join(', ')}\n`;
  if (uni.educationLanguages?.length > 0) response += `🌐 **Ta'lim tillari:** ${uni.educationLanguages.map((l: any) => l.name).join(', ')}\n`;
  if (uni.admissionPhone && uni.admissionPhone !== uni.phone) response += `📞 **Qabul telefon:** ${uni.admissionPhone}\n`;
  if (uni.isOpenForAdmission !== undefined) response += `${uni.isOpenForAdmission ? '✅' : '❌'} **Qabul:** ${uni.isOpenForAdmission ? 'Ochiq' : 'Yopiq'}\n`;
  response += `\n📌 **[Mentalaba.uz da batafsil ko'rish](https://mentalaba.uz/universities/${slug})** — barcha yo'nalishlar, grantlar va qabul shartlari\n\n😊 Yana biror universitet haqida ma'lumot kerakmi yoki qo'shimcha savolingiz bormi?`;
  return response;
}

/** Universitet topilmadi (search_university uchun) */
export function universityNotFoundResponse(): string {
  return `Kechirasiz, sizning so'rovingiz bo'yicha universitet topilmadi. 😔\n\nIltimos, boshqa shartlar yoki hudud bo'yicha qidirib ko'ring.\n\n📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha universitetlar katalogi\n\nYana qanday yordam kerak? 😊`;
}

/**
 * RESPONSE COMPOSER (BOSQICH 12): bitta universitеt + ANIQ FIELD so'ralganda
 * faqat o'sha maydonni chiqaradi. "PDP telefoni?" → telefon, "uning narxlari
 * qancha?" → kontrakt narxi. To'liq karta emas — aynan so'ralgan ma'lumot.
 */
export function formatUniversityField(uni: any, field: Exclude<RequestField, null | "summary">): string {
  const name = uni.fullNameUz || uni.fullNameEn || "Universitet";
  const slug = uni.slug || "";
  const detailLink = `📌 **[Mentalaba.uz](https://mentalaba.uz/universities/${slug})** — batafsil ma'lumot`;

  switch (field) {
    case "phone": {
      const phone = uni.admissionPhone || uni.phone;
      if (!phone) break;
      return `📞 **${name} telefoni:** ${phone}\n\n${detailLink}`;
    }
    case "tuition": {
      const tuition = uni.tuition && uni.tuition !== "N/A" ? uni.tuition : null;
      if (!tuition) break;
      return `💰 **${name} kontrakt narxi:** ${tuition}\n\n${detailLink}`;
    }
    case "hostel": {
      if (uni.hasAccommodation === undefined) break;
      return `🏠 **${name} yotoqxonasi:** ${uni.hasAccommodation ? "Bor ✅" : "Yo'q ❌"}\n\n${detailLink}`;
    }
    case "grant": {
      if (uni.hasGrant === undefined) break;
      return `💰 **${name} granti:** ${uni.hasGrant ? "Mavjud ✅" : "Yo'q ❌"}\n\n${detailLink}`;
    }
    case "admission": {
      if (uni.isOpenForAdmission === undefined && !uni.admissionStartDate && !uni.admissionDeadline) break;
      let resp = `🎓 **${name} qabul holati:**\n`;
      if (uni.isOpenForAdmission !== undefined) {
        resp += `${uni.isOpenForAdmission ? "✅ **Ochiq**" : "❌ **Yopiq**"}\n`;
      }
      if (uni.admissionStartDate) resp += `📅 **Boshlanishi:** ${uni.admissionStartDate}\n`;
      if (uni.admissionDeadline) resp += `⏰ **Oxirgi muddat:** ${uni.admissionDeadline}\n`;
      return `${resp}${detailLink}`;
    }
    case "website": {
      const website = uni.website;
      if (!website) break;
      return `🌐 **${name} sayti:** [${website.replace(/^https?:\/\//, "")}](${website})\n\n${detailLink}`;
    }
    case "email": {
      const email = uni.email || uni.supportEmail;
      if (!email) break;
      return `📧 **${name} elektron pochtasi:** [${email}](mailto:${email})\n\n${detailLink}`;
    }
    case "address": {
      const address = uni.addressUz || uni.location || uni.addressEn;
      if (!address) break;
      return `📍 **${name} manzili:** ${address}\n\n${detailLink}`;
    }
    case "directions": {
      const count = uni.directionCount;
      if (count === undefined || count === null) break;
      return `📚 **${name} yo'nalishlari:** ${count} ta\n\n${detailLink}`;
    }
    default:
      break;
  }

  // REVIEWER FIX (BOSQICH 12): so'ralgan field ma'lumoti YO'Q bo'lsa, to'liq
  // karta ko'rsatish emas — aniq javob: bu ma'lumot topilmadi (user "faqat
  // telefon" degan bo'lsa, kutilmaganda to'liq karta ko'rinishi noto'g'ri).
  const fieldLabelMap: Record<string, string> = {
    phone: "telefon", tuition: "kontrakt narxi", hostel: "yotoqxona",
    grant: "grant", admission: "qabul holati", website: "sayt",
    email: "elektron pochta", address: "manzil", directions: "yo'nalishlar",
  };
  const label = fieldLabelMap[field] || "bu ma'lumot";
  return `Kechirasiz, **${name}** uchun ${label} ma'lumoti hozircha topilmadi. 😔\n\n${detailLink}`;
}
