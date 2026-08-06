/**
 * FORMATTER: search_tuition tool natijalarini formatlash.
 */

export function formatTuitionSearch(firstResult: any): string {
  const data = firstResult.data;
  if (!data?.hasData || !Array.isArray(data.universities) || data.universities.length === 0) {
    return tuitionNotFoundResponse();
  }
  // Fix 18: follow-up holatida (user avval bitta universitet so'ragan) —
  // "Umumiy narx oralig'i" emas, o'sha universitetning narxini ko'rsatamiz.
  const isFollowUp = data.isFollowUp === true;
  let response = isFollowUp
    ? `### 💰 ${data.focusName || 'Universitet'} kontrakt narxi\n\n`
    : "### 💰 Kontrakt narxlari bo'yicha eng arzonlari\n\n";
  if (isFollowUp && data.universities.length === 1) {
    const u = data.universities[0];
    response += `**${u.name}** — 💵 **${u.tuition}**\n`;
    if (u.location) response += `📍 *${u.location}*\n`;
    if (u.slug) response += `\n[🔍 Mentalaba.uz da ko'rish](https://mentalaba.uz/universities/${u.slug})\n`;
    response += `\nYana qanday ma'lumot kerak? 😊`;
    return response;
  }
  response += `Umumiy narx oralig'i: **${(data.minTuition / 1000000).toFixed(0)} - ${(data.maxTuition / 1000000).toFixed(0)} mln so'm**\n\n`;
  data.universities.slice(0, 10).forEach((uni: any, i: number) => {
    response += `${i + 1}. **${uni.name}** — 💵 ${uni.tuition}`;
    if (uni.location) response += ` (${uni.location})`;
    response += `\n`;
    if (uni.slug) response += `   [🔍 Mentalaba.uz da ko'rish](https://mentalaba.uz/universities/${uni.slug})\n`;
  });
  response += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha universitetlar\n\nQaysi biri haqida batafsil ma'lumot olishni xohlaysiz? 😊`;
  return response;
}

export function tuitionNotFoundResponse(): string {
  return "Kechirsiz, hozircha kontrakt narxlari bo'yicha ma'lumot topilmadi. 😔\n\n📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha universitetlar katalogi";
}
