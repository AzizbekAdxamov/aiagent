/**
 * FORMATTER: search_direction va list_directions tool natijalarini formatlash.
 */

/** search_direction — "yo'nalish qidiruvi" natijalari */
export function formatDirectionSearch(firstResult: any, message: string): string {
  const directionsData = Array.isArray(firstResult.data)
    ? { directions: firstResult.data, universities: [], universityDirections: undefined }
    : firstResult.data;
  const data = Array.isArray(directionsData.directions) ? directionsData.directions : [];
  const uniList = Array.isArray(directionsData.universities) ? directionsData.universities : [];
  const uniDir = directionsData.universityDirections;

  // Aniq universitet bo'yicha so'ralganda — barcha yo'nalish nomlari
  if (uniDir && uniDir.directionNames?.length > 0) {
    let response = `### 📚 ${uniDir.universityName} yo'nalishlari\n\n`;
    response += `Jami **${uniDir.totalCount} ta** yo'nalish mavjud! 🎉\n\n`;
    response += `**To'liq ro'yxat:**\n`;
    uniDir.directionNames.slice(0, 30).forEach((name: string, i: number) => {
      response += `${i + 1}. ${name}\n`;
    });
    if (uniDir.directionNames.length > 30) {
      response += `\n... va yana ${uniDir.directionNames.length - 30} ta yo'nalish\n`;
    }
    if (uniDir.universitySlug) {
      response += `\n📌 **[Mentalaba.uz da batafsil](https://mentalaba.uz/universities/${uniDir.universitySlug})** — qabul shartlari, grantlar va kontrakt narxlari\n`;
    }
    response += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/directions)** — barcha yo'nalishlar katalogi\n\nYana qanday yordam kerak? 😊`;
    return response;
  }

  if (data.length === 0) {
    return "Kechirasiz, sizning so'rovingiz bo'yicha yo'nalish topilmadi. 😔 Boshqa soha yoki shaharni ko'raylikmi?";
  }

  if (uniList.length > 0) {
    const totalMatches = directionsData.totalMatches ?? uniList.length;
    let response = "### 🎓 Sizga mos universitetlar\n\n";
    response += `"${message}" so'roviga mos **${totalMatches} ta** universitetda yo'nalish topildi! 🎉\n\n`;

    uniList.slice(0, 8).forEach((uni: any, i: number) => {
      response += `---\n\n`;
      response += `**${i + 1}. ${uni.fullNameUz || uni.fullNameEn}**\n\n`;
      if (uni.descriptionUz) {
        const shortDesc = uni.descriptionUz.substring(0, 250) + (uni.descriptionUz.length > 250 ? '...' : '');
        response += `${shortDesc}\n\n`;
      }
      if (uni.institutionCategory) response += `📋 **Turi:** ${uni.institutionCategory}\n`;
      if (uni.location) response += `📍 **Manzil:** ${uni.location}\n`;
      response += `${uni.hasGrant ? '✅' : '❌'} **Grant:** ${uni.hasGrant ? 'Mavjud' : "Yo'q"}\n`;
      response += `${uni.hasAccommodation ? '✅' : '❌'} **Yotoqxona:** ${uni.hasAccommodation ? 'Bor' : "Yo'q"}\n`;
      if (uni.tuition && uni.tuition !== 'N/A') response += `💰 **To'lov:** ${uni.tuition}\n`;
      if (uni.phone) response += `📞 **Telefon:** ${uni.phone}\n`;
      if (uni.website) response += `🌐 **Sayt:** ${uni.website}\n`;
      response += `${uni.isOpenForAdmission ? '✅' : '❌'} **Qabul:** ${uni.isOpenForAdmission ? 'Ochiq' : 'Yopiq'}\n`;
      if (uni.slug) response += `[🔍 Mentalaba.uz da batafsil ko'rish](https://mentalaba.uz/universities/${uni.slug})\n`;
      response += `\n`;
    });

    if (totalMatches > uniList.length) {
      response += `---\n\n📌 **Yana ${totalMatches - uniList.length} ta** universitetda ham shu yo'nalish bor! Barchasini [Mentalaba.uz](https://mentalaba.uz/directions) da ko'rishingiz mumkin.\n\n`;
    }

    const dirsForShownUnis = data.filter((d: any) =>
      uniList.slice(0, 8).some((u: any) => u.id === d.universityId)
    );
    if (dirsForShownUnis.length > 0) {
      response += `---\n\n**📚 Mos yo'nalishlar:**\n`;
      dirsForShownUnis.slice(0, 10).forEach((dir: any) => {
        response += `• ${dir.nameUz || dir.nameEn} — *${dir.universityName}*\n`;
      });
      response += `\n`;
    }

    response += `📌 **[Mentalaba.uz](https://mentalaba.uz/directions)** — barcha yo'nalishlar katalogi\n\nQaysi biriga batafsil qarashni xohlaysiz? 😊`;
    return response;
  }

  let response = "### 📚 Yo'nalishlar\n\n";
  response += "Mana bir nechta variantlar:\n\n";
  data.slice(0, 8).forEach((dir: any, i: number) => {
    response += `${i + 1}. **${dir.nameUz || dir.nameEn}** ${dir.universityName ? `— ${dir.universityName}` : ''}\n`;
  });

  response += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/directions)** — barcha yo'nalishlar katalogi\n\nYana qanday yo'nalishlar qiziqtiradi? Yoki ma'lum bir universitet bo'yicha ko'rishni xohlaysizmi? 😊`;
  return response;
}

/** list_directions — "qanday yo'nalishlar mavjud?" katalog */
export function formatDirectionList(firstResult: any): string {
  const categories = Array.isArray(firstResult.data?.categories) ? firstResult.data.categories : [];
  if (categories.length === 0) {
    return "Kechirasiz, hozircha yo'nalishlar ro'yxati tayyor emas. 😔\n\n📌 **[Mentalaba.uz](https://mentalaba.uz/directions)** — barcha yo'nalishlar katalogi";
  }
  let response = "### 📚 Qanday yo'nalishlar mavjud?\n\n";
  response += "O'zbekistondagi oliy ta'lim yo'nalishlari:\n\n";
  categories.forEach((cat: any, i: number) => {
    response += `${i + 1}. ${cat.icon || '📚'} **${cat.label || cat.id}**\n`;
  });
  response += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/directions)** — barcha yo'nalishlar katalogi\n\nQaysi biri sizni qiziqtiradi? Aytganingizda sizga mos universitetlarni topib beraman! 😊`;
  return response;
}

/** direction_search empty → fallback */
export function directionNotFoundResponse(): string {
  return `Kechirasiz, sizning so'rovingiz bo'yicha yo'nalish topilmadi. 😔\n\nIltimos, boshqa soha yoki shaharni ko'raylikmi? Masalan:\n• 📚 "IT yo'nalishlari"\n• 💰 "Grantlar bormi"\n• 🏛 "Toshkentdagi universitetlar"\n\nYoki menga o'z xohishingizni ayting!`;
}

/** direction_list empty → fallback */
export function directionListNotFoundResponse(): string {
  return `### 📚 Qanday yo'nalishlar mavjud?\n\nO'zbekistondagi oliy ta'lim yo'nalishlari:\n\n💻 **IT va dasturlash**\n🏥 **Tibbiyot**\n💰 **Iqtisod va moliya**\n⚖️ **Huquq**\n📚 **Pedagogika**\n🏗️ **Muhandislik**\n🗣️ **Filologiya (tillar)**\n🎨 **San'at**\n⚽ **Sport**\n🌾 **Qishloq xo'jaligi**\n🧳 **Turizm**\n\n📌 **[Mentalaba.uz](https://mentalaba.uz/directions)** — barcha yo'nalishlar katalogi\n\nQaysi biri sizni qiziqtiradi? Aytganingizda sizga mos universitetlarni topib beraman! 😊`;
}
