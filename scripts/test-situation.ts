/**
 * STAGE 14c TEST — Conversation Situation Memory + Recommendation vs Search + LLM composer
 *
 * Testlar:
 * 1. extractAdmissionFailed / extractWantsToStudy extractorlar
 * 2. updateRecommendationProfile — admissionFailed + wantsToStudy yig'ilishi
 * 3. isSituationalRecommendation — conversation context asosida:
 *    - "imtihondan yiqildim" konteksti + "tibbiyotga qiziqaman" → recommendation
 *    - "Toshkentda tibbiyot yo'nalishi bormi?" (katalog) → search qoladi
 *    - aniq university nomi → search qoladi
 *    - direction_detail → search qoladi
 *    - vaziyatsiz oddiy "tibbiyot universitetlari" → search qoladi
 */
import { extractAdmissionFailed, extractWantsToStudy, updateRecommendationProfile, isSituationalRecommendation } from "../src/ai-agent/follow-up-context";
import { intentClassifier } from "../src/ai-agent/intent-classifier";

let pass = 0;
let fail = 0;

function check(label: string, actual: any, expected: any) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`✅ ${label}`); }
  else { fail++; console.log(`❌ ${label}\n   kutilgan: ${JSON.stringify(expected)}\n   chiqqan:  ${JSON.stringify(actual)}`); }
}

console.log("=== 1. Extractorlar ===");
check("imtihondan yiqildim → admissionFailed", extractAdmissionFailed("men bu yil imtihondan yiqildim"), true);
check("o'qishga kira olmadim → admissionFailed", extractAdmissionFailed("universitetlarga kira olmadim"), true);
check("ballim yetmadi → admissionFailed", extractAdmissionFailed("ballim yetmadi"), true);
check("oddiy gap → false", extractAdmissionFailed("tibbiyotga qiziqaman"), false);
check("o'qimoqchiman → wantsToStudy", extractWantsToStudy("men o'qishni davom ettirmoqchiman"), true);
check("kirmoqchiman → wantsToStudy", extractWantsToStudy("bu yil kirmoqchiman"), true);
check("oddiy gap → wantsToStudy false", extractWantsToStudy("tibbiyot qayerda bor"), false);

console.log("\n=== 2. Profile yig'ilishi (TASK 1) ===");
{
  let profile: any = {};
  profile = updateRecommendationProfile(profile, "men bu yil imtihondan yiqildim", {});
  check("admissionFailed yig'ildi", profile.admissionFailed, true);
  profile = updateRecommendationProfile(profile, "lekin doktor bo'lishni xohlayman, o'qishga kirmoqchiman", { direction: "tibbiyot" });
  check("wantsToStudy yig'ildi", profile.wantsToStudy, true);
  check("interest qo'shildi", profile.interests, ["tibbiyot"]);
}

console.log("\n=== 3. isSituationalRecommendation (TASK 2) ===");
{
  // Context: admissionFailed=true (oldingi xabardan yig'ilgan)
  const ctxWithSituation: any = {
    recommendationProfile: { admissionFailed: true, wantsToStudy: true },
  };
  // Context: vaziyatsiz
  const ctxEmpty: any = { recommendationProfile: {} };

  const t1 = intentClassifier.classify("men yoshligimdan tibbiyotga qiziqaman. Toshkent shahrida");
  console.log(`   [info] \"tibbiyotga qiziqaman, Toshkent shahrida\" → intent=${t1.intent}`);
  check("vaziyat konteksti + qiziqish → recommendation", isSituationalRecommendation("men yoshligimdan tibbiyotga qiziqaman. Toshkent shahrida", t1, ctxWithSituation), true);

  const t2 = intentClassifier.classify("Toshkentda tibbiyot yo'nalishi bormi");
  check("katalog so'rovi → search qoladi", isSituationalRecommendation("Toshkentda tibbiyot yo'nalishi bormi", t2, ctxWithSituation), false);

  const t3 = intentClassifier.classify("Toshkent tibbiyot akademiyasi haqida ma'lumot ber");
  check("aniq university → search qoladi", isSituationalRecommendation("Toshkent tibbiyot akademiyasi haqida ma'lumot ber", t3, ctxWithSituation), false);

  const t4 = intentClassifier.classify("davolash ishi haqida ko'proq ma'lumot");
  t4.entities = { ...t4.entities, queryType: "direction_detail" };
  check("direction_detail → search qoladi", isSituationalRecommendation("davolash ishi haqida ko'proq ma'lumot", t4, ctxWithSituation), false);

  const t5 = intentClassifier.classify("tibbiyotga qiziqaman");
  check("vaziyatsiz qiziqish (kontekst yo'q) → search qoladi", isSituationalRecommendation("tibbiyotga qiziqaman", t5, ctxEmpty), false);

  // "imtihondan yiqildim lekin o'qimoqchiman" → classifier ALLAQACHON
  // recommendation deb aniqlaydi (override kerak emas) — shuning uchun
  // search intent'li real senariy tanlanadi: direction bilan qiziqish.
  const t6 = intentClassifier.classify("imtihondan yiqildim, tibbiyotga qiziqaman");
  console.log(`   [info] "imtihondan yiqildim, tibbiyotga qiziqaman" → intent=${t6.intent}`);
  check("hozirgi xabarda vaziyat + qiziqish → recommendation", isSituationalRecommendation("imtihondan yiqildim, tibbiyotga qiziqaman", t6, ctxEmpty), true);

  // Jingalak apostrofli variant ham (real foydalanuvchi yozuvi)
  const t6b = intentClassifier.classify("imtihondan yiqildim lekin o\u2018qimoqchiman");
  check("jingalak apostrof → recommendation", isSituationalRecommendation("imtihondan yiqildim lekin o\u2018qimoqchiman", t6b, ctxEmpty), true);

  const t7 = intentClassifier.classify("IT yo'nalishlari ro'yxati");
  check("ro'yxat so'rovi → search qoladi", isSituationalRecommendation("IT yo'nalishlari ro'yxati", t7, ctxWithSituation), false);

  const t8 = intentClassifier.classify("Toshkentda yashayman, tibbiyotga qiziqaman");
  check("yashayman + qiziqish (vaziyat kontekstisiz) → search", isSituationalRecommendation("Toshkentda yashayman, tibbiyotga qiziqaman", t8, ctxEmpty), false);

  const t9 = intentClassifier.classify("tibbiyotga qiziqaman, Toshkentda yashayman");
  check("vaziyat konteksti + yashayman → recommendation", isSituationalRecommendation("tibbiyotga qiziqaman, Toshkentda yashayman", t9, ctxWithSituation), true);
}

console.log(`\n=== NATIJA: ${pass} ✅ / ${fail} ❌ ===`);
process.exit(fail > 0 ? 1 : 0);
