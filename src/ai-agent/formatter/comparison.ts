/**
 * FORMATTER: compare_universities tool natijalarini formatlash.
 */

export function formatComparison(firstResult: any): string {
  const data = Array.isArray(firstResult.data) ? firstResult.data : [firstResult.data];
  if (data.length === 0) return "Kechirasiz, taqqoslash uchun ma'lumot topilmadi. 😔";
  let response = "### ⚖️ Universitetlarni taqqoslash\n\n";
  response += "Mana siz uchun solishtirma jadval:\n\n";
  data.slice(0, 5).forEach((uni: any, i: number) => {
    response += `**${i + 1}. ${uni.name}**\n`;
    response += `📌 [Mentalaba.uz da ko'rish](https://mentalaba.uz/universities/${uni.slug || ''})\n`;
    response += `| **Turi** | ${uni.type || 'N/A'} |\n`;
    response += `| **Manzil** | ${uni.location || 'N/A'} |\n`;
    response += `| **💰 Grant** | ${uni.hasGrant ? '✅ Mavjud' : "❌ Yo'q"} |\n`;
    response += `| **🏠 Yotoqxona** | ${uni.hasAccommodation ? '✅ Bor' : "❌ Yo'q"} |\n`;
    response += `| **💵 To'lov** | ${uni.tuition || 'N/A'} |\n`;
    response += `| **📚 Yo'nalishlar** | ${uni.directionCount || 'N/A'} ta |\n`;
    response += `| **🎓 Talabalar** | ${uni.studentsCount ? `~${Math.round(uni.studentsCount / 1000)}k` : 'N/A'} |\n`;
    response += `| **🚪 Qabul** | ${uni.isOpenForAdmission ? '✅ Ochiq' : '❌ Yopiq'} |\n`;
    response += `\n`;
  });
  response += `📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha universitetlar katalogi\n\nQaysi biriga batafsil qarashni xohlaysiz? 😊`;
  return response;
}
