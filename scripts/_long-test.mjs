// UZOQ ZANJIR TESTI — bitta chat ichida 22 xabarlik haqiqiy foydalanuvchi yo'li
// Qoidalar: sessionId bir xil, hech qachon boshqa chatga o'tmaydi.
// Har javob tekshiriladi: bo'sh/error bo'lmasin, keyingi savol kontekstdan foydalansin.
const BASE = process.env.BASE_URL || "http://127.0.0.1:3001/api/v1/chat";
let sid = null;
let ok = 0, fail = 0;

async function send(m, note = "") {
  const body = { message: m, language: "uz" };
  if (sid) body.sessionId = sid;
  const t0 = Date.now();
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let j;
  try { j = await res.json(); } catch { j = null; }
  sid = j?.data?.sessionId || j?.sessionId || sid;
  const ms = Date.now() - t0;
  const answer = (j?.data?.message || (j?.error ? `❌ ${j.error}` : "❌ NO ANSWER")).trim();
  const isError = !answer || answer.startsWith("❌") || /DOCTYPE|error/i.test(answer.slice(0, 30));
  const firstLine = answer.split("\n").filter(l => l.trim()).slice(0, 2).join(" ⏎ ").slice(0, 150);
  if (isError) { fail++; console.log(`❌ [${ms}ms] "${m}" (${note})\n   → ${firstLine}`); }
  else { ok++; console.log(`✅ [${ms}ms] "${m}" (${note})\n   → ${firstLine}`); }
  return { answer, ms };
}

const sleep = (ms) => new Promise(r => setTimeout(r, 250));

const run = async () => {
  // ===== 1. BOSHLANISH =====
  await send("Assalomu alaykum!", "greeting");
  await sleep();

  // ===== 2. UZUN SAVOL — to'liq ma'lumot bitta gapda =====
  await send(
    "Men bu yil o'qishga kirmoqchiman, Samarqandda yashayman, matematikam unchalik yaxshi emas lekin informatika va sun'iy intellektga juda qiziqaman, ingliz tilim B2 darajasida, byudjetim 20 million so'mgacha, grant imkoniyati bo'lsa yanada yaxshi, yotoqxonasi bo'lishi kerak. Menga eng mos universitetlarni tavsiya qilib bering va nima uchun aynan shularni tanlaganingizni tushuntiring.",
    "UZUN to'liq so'rov"
  );
  await sleep();

  // ===== 3. SOFT CLARIFICATION: 3-savolga javob (davlat) =====
  await send("davlat", "clarification answer");
  await sleep();

  // ===== 4. FOLLOW-UP: nega aynan shu? =====
  await send("Nega aynan shu universitеtni tanladingiz? Sabablarini batafsil ayting", "explanation");
  await sleep();

  // ===== 5. NEGA IKKINCHISI? (navigation) =====
  await send("Keyingisi-chi? Uning ham afzalliklari nima?", "nav");
  await sleep();

  // ===== 6. UNIVERSITET DETAIL =====
  await send("Birinchi tavsiya qilingan universitеt haqida batafsil ma'lumot bering", "detail");
  await sleep();

  // ===== 7. FIELD: kontrakt =====
  await send("Uning kontrakt narxlari qancha?", "tuition field");
  await sleep();

  // ===== 8. FIELD: grant =====
  await send("Granti bormi?", "grant field");
  await sleep();

  // ===== 9. FIELD: yotoqxona =====
  await send("Yotoqxonasi-chi?", "hostel field");
  await sleep();

  // ===== 10. FIELD: telefon =====
  await send("Telefon raqamini berib yuboring", "phone field");
  await sleep();

  // ===== 11. CONTEXT REPAIR: boshqa universitеtga o'tish =====
  await send("Yo'q, men aslida TATU haqida so'ramoqchi edim", "repair");
  await sleep();

  // ===== 12. YANGI UNIVER: TATU detail =====
  await send("TATU qaysi shaharda joylashgan?", "TATU detail");
  await sleep();

  // ===== 13. DIRECTION: IT yo'nalishlari =====
  await send("TATUda qanday IT yo'nalishlari bor?", "TATU directions");
  await sleep();

  // ===== 14. KOMPARATSIYA =====
  await send("TATU va TUITni solishtirib bering", "comparison");
  await sleep();

  // ===== 15. TUITION (context: comparison dan keyin) =====
  await send("Ulardan qaysi birining kontrakti arzonroq?", "tuition comparison");
  await sleep();

  // ===== 16. GRANT SEARCH =====
  await send("O'zbekistonda qanday davlat grantlari mavjud?", "grant search");
  await sleep();

  // ===== 17. QABUL =====
  await send("Qabul qachon boshlanadi va hujjatlarni qanday topshiraman?", "admission");
  await sleep();

  // ===== 18. NEW TOPIC: tibbiyot =====
  await send("Aslida men tibbiyotga ham qiziqaman, qanday tibbiyot yo'nalishlari bor?", "direction switch");
  await sleep();

  // ===== 19. SHAHAR FILTER =====
  await send("Samarqandda tibbiyot bo'yicha o'qiydiganlar bormi?", "city filter");
  await sleep();

  // ===== 20. REKOMENDATSIYA: yangi profil =====
  await send("Menga Samarqandda tibbiyot yo'nalishida o'qish uchun eng yaxshi variantni tavsiya qiling", "recommend v2");
  await sleep();

  // ===== 21. NEAR FIELD =====
  await send("Buning narxi qancha?", "tuition near");
  await sleep();

  // ===== 22. YANGILIKLAR =====
  await send("So'nggi ta'lim yangiliklarini aytib bering", "news");
  await sleep();

  // ===== 23. YAKUN =====
  await send("Rahmat, juda foydali bo'ldi!", "thanks");
  await sleep();

  console.log(`\n📊 JAMI: ${ok} ✅ / ${fail} ❌ / ${ok + fail} xabar (bitta chat)`);
  process.exit(fail > 0 ? 1 : 0);
};

run();
