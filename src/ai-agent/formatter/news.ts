/**
 * FORMATTER: search_news tool natijalarini formatlash.
 */

export function formatNewsSearch(firstResult: any): string {
  const data = Array.isArray(firstResult.data) ? firstResult.data : [firstResult.data];
  if (data.length === 0) return newsNotFoundResponse();
  let response = "### 📰 So'nggi yangiliklar\n\n";
  data.slice(0, 5).forEach((news: any, i: number) => {
    response += `${i + 1}. **${news.titleUz || news.titleEn}**\n`;
    if (news.descriptionUz) response += `   ${news.descriptionUz.substring(0, 150)}...\n`;
  });
  response += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/news)** — barcha yangiliklar\n\nYana qanday ma'lumot kerak? 😊`;
  return response;
}

export function newsNotFoundResponse(): string {
  return "Kechirasiz, hozircha yangiliklar topilmadi. 😔\n\n📌 **[Mentalaba.uz](https://mentalaba.uz/news)** — yangiliklar bo'limi";
}
