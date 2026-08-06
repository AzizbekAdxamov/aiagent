/**
 * FORMATTER: explain_recommendation — "Nega aynan X?" tushuntirish.
 * Backend recommend tool hisoblagan score.reasons/nuances asosida javob.
 * LLM emas — backend sabablari (eng ishonchli, takrorlanadigan).
 */
export function formatExplanation(firstResult: any): string {
  const data = firstResult.data;
  if (!data?.university) {
    return "Kechirasiz, hozircha tavsiya sababini topa olmadim. 😔\n\nAvval biror universitet tavsiyasini oling (masalan: *\"menga IT yo'nalishidagi universitet tavsiya qil\"*), keyin so'rang: *\"Nega aynan shu?\"*";
  }

  const uniName = data.university.name || "Universitet";
  const score = data.score;

  // Score bo'lmasa — alternativalar ballini ko'rsatamiz
  if (!score || (!score.reasons?.length && !score.nuances?.length)) {
    let response = `### 🤔 ${uniName} tavsiya sababi\n\n`;
    response += "Bu universitet avvalgi tavsiyalar ro'yxatida **eng yuqori ball** olgani uchun tanlandi.\n\n";
    if (Array.isArray(data.recommendations) && data.recommendations.length > 0) {
      response += "**Ballar taqqoslamasi:**\n";
      for (const r of data.recommendations) {
        response += `• ${r.name} — ${r.total ?? "—"} ball\n`;
      }
    }
    response += "\n📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha universitetlar katalogi\n\nYana qanday yordam kerak? 😊";
    return response;
  }

  let response = `### 🎯 Nega aynan **${uniName}**?\n\n`;
  response += `Ushbu universitet sizning so'rovingiz bo'yicha **${score.total ?? "yuqori"} ball** to'pladi. Buning sabablari:\n\n`;

  if (Array.isArray(score.reasons) && score.reasons.length > 0) {
    score.reasons.slice(0, 5).forEach((reason: string) => {
      response += `✅ ${reason}\n`;
    });
  }

  if (Array.isArray(score.nuances) && score.nuances.length > 0) {
    response += `\n⚠️ *E'tibor berish kerak:*\n`;
    score.nuances.slice(0, 3).forEach((n: string) => {
      response += `• ${n}\n`;
    });
  }

  response += "\n📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha universitetlar katalogi\n\nBoshqa birini solishtirmoqchimisiz? Masalan: *\"TATU va INHA ni solishtir\"* 😊";
  return response;
}
