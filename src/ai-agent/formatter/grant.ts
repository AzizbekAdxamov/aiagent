/**
 * FORMATTER: search_grants tool natijalarini formatlash.
 */

export function formatGrantsSearch(firstResult: any): string {
  const data = Array.isArray(firstResult.data) ? firstResult.data : [firstResult.data];
  if (data.length === 0) return grantsNotFoundResponse();
  let response = "### 💰 Grantlar\n\n";
  response += "Ajoyib! Sizga mos grantlar topildi 🎉\n\n";
  data.slice(0, 5).forEach((grant: any, i: number) => {
    response += `${i + 1}. **${grant.grantTitleUz || grant.grantTitleEn}**\n`;
    if (grant.universityNameUz) response += `   • **Universitet:** ${grant.universityNameUz}\n`;
    if (grant.grantDescUz) response += `   • ${grant.grantDescUz.substring(0, 200)}...\n`;
  });
  response += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/grants)** — barcha grantlar\n\nYana biror narsa bo'yicha yordam kerakmi? 😊`;
  return response;
}

export function grantsNotFoundResponse(): string {
  return "Kechirasiz, hozircha faol grantlar topilmadi. 😔 Yangi grantlar e'lon qilinganda xabar beramiz!\n\n📌 **[Mentalaba.uz](https://mentalaba.uz/grants)** — grantlar bo'limi\n\nYana qanday yordam kerak?";
}
