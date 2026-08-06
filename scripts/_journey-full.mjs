const BASE = "http://localhost:3000/api/v1/chat";

// ==== BARCHA BOSQICHLAR (bitta sessiya) ====
const JOURNEY = [
  // 1. Boshlanish
  { stage: "1. Boshlanish", msg: "Assalomu alaykum" },
  { stage: "1. Boshlanish", msg: "Men bu yil o'qishga topshirmoqchiman" },
  { stage: "1. Boshlanish", msg: "Menga yordam bera olasizmi?" },

  // 2. Yo'nalishni tanlash
  { stage: "2. Yo'nalish", msg: "Qanday yo'nalishlar mavjud?" },
  { stage: "2. Yo'nalish", msg: "Eng talab yuqori yo'nalishlar qaysilar?" },
  { stage: "2. Yo'nalish", msg: "IT va Tibbiyotning farqi nima?" },
  { stage: "2. Yo'nalish", msg: "Men matematikani yaxshi ko'raman, nima tavsiya qilasiz?" },
  { stage: "2. Yo'nalish", msg: "Biologiyam yaxshi, qaysi yo'nalish mos?" },
  { stage: "2. Yo'nalish", msg: "Men shifokor bo'lmoqchiman." },
  { stage: "2. Yo'nalish", msg: "Stomatologiya bormi?" },
  { stage: "2. Yo'nalish", msg: "Farmatsiya haqida ma'lumot bering." },

  // 3. Universitet qidirish
  { stage: "3. Universitet", msg: "Toshkentdagi universitetlarni ko'rsating." },
  { stage: "3. Universitet", msg: "Tibbiyot universitetlari kerak." },
  { stage: "3. Universitet", msg: "Davlatlari qaysilar?" },
  { stage: "3. Universitet", msg: "Xususiylari-chi?" },
  { stage: "3. Universitet", msg: "Ingliz tilida o'qitadiganlari bormi?" },
  { stage: "3. Universitet", msg: "Magistratura ham bormi?" },
  { stage: "3. Universitet", msg: "Sirtqi ta'lim bormi?" },

  // 4. Universitetni tanlash
  { stage: "4. Tanlash", msg: "Toshkent tibbiyot akademiyasi haqida ayting." },
  { stage: "4. Tanlash", msg: "SamDU tibbiyot fakulteti bormi?" },
  { stage: "4. Tanlash", msg: "Akfa Med haqida ma'lumot." },
  { stage: "4. Tanlash", msg: "TTA va AKFA Medni solishtiring." },
  { stage: "4. Tanlash", msg: "Qaysi biri yaxshiroq?" },

  // 5. Kontrakt
  { stage: "5. Kontrakt", msg: "Kontrakti qancha?" },
  { stage: "5. Kontrakt", msg: "Eng arzonlari qaysilar?" },
  { stage: "5. Kontrakt", msg: "20 milliongacha kontrakti borlari." },
  { stage: "5. Kontrakt", msg: "Davlat granti bormi?" },
  { stage: "5. Kontrakt", msg: "Super kontrakt bormi?" },

  // 6. Qabul
  { stage: "6. Qabul", msg: "Kirish ballari qancha?" },
  { stage: "6. Qabul", msg: "Qanday fan topshiraman?" },
  { stage: "6. Qabul", msg: "Hujjatlarni qanday topshiraman?" },
  { stage: "6. Qabul", msg: "Qabul qachon boshlanadi?" },
  { stage: "6. Qabul", msg: "Imtihon qachon?" },

  // 7. Joylashuv
  { stage: "7. Joylashuv", msg: "Samarqanddagilari." },
  { stage: "7. Joylashuv", msg: "Andijondagilari." },
  { stage: "7. Joylashuv", msg: "Farg'onadagilari." },
  { stage: "7. Joylashuv", msg: "Xorazmdagilari." },
  { stage: "7. Joylashuv", msg: "Nukusdagilari." },

  // 8. Follow-up
  { stage: "8. Follow-up", msg: "ITlari." },
  { stage: "8. Follow-up", msg: "Davlatlari." },
  { stage: "8. Follow-up", msg: "Ingliz tilidagilari." },
  { stage: "8. Follow-up", msg: "Kontrakti qancha?" },
  { stage: "8. Follow-up", msg: "Grantlari bormi?" },
  { stage: "8. Follow-up", msg: "Magistraturasi-chi?" },

  // 9. Solishtirish
  { stage: "9. Solishtirish", msg: "TATU yoki INHA?" },
  { stage: "9. Solishtirish", msg: "Amity yoki Westminster?" },
  { stage: "9. Solishtirish", msg: "Davlatmi yoki xususiymi?" },
  { stage: "9. Solishtirish", msg: "ITmi yoki Sun'iy intellekt?" },

  // 10. Maslahat
  { stage: "10. Maslahat", msg: "Men nima o'qisam ekan?" },
  { stage: "10. Maslahat", msg: "Pulim kam." },
  { stage: "10. Maslahat", msg: "IELTS 6.5 bor." },
  { stage: "10. Maslahat", msg: "Ingliz tilim yaxshi." },
  { stage: "10. Maslahat", msg: "Matematikam unchalik emas." },
  { stage: "10. Maslahat", msg: "Dasturlashni yaxshi ko'raman." },
  { stage: "10. Maslahat", msg: "Chet elda ishlamoqchiman." },
  { stage: "10. Maslahat", msg: "Qaysi yo'nalishni tavsiya qilasiz?" },

  // 11. Yakun
  { stage: "11. Yakun", msg: "Rahmat." },
  { stage: "11. Yakun", msg: "Shu universitetning linkini yuboring." },
  { stage: "11. Yakun", msg: "Telefon raqamini bering." },
  { stage: "11. Yakun", msg: "Manzilini yuboring." },
];

let sessionId;
let results = [];
let stageCounts = {};

for (const item of JOURNEY) {
  const t0 = Date.now();
  const body = { message: item.msg, language: "uz" };
  if (sessionId) body.sessionId = sessionId;
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  const d = j.data || {};
  sessionId = d.sessionId || sessionId;
  const m = d.message || "";

  // Natija baholash
  const genericFail = m.includes("topa olmadim") || m.includes("Kechirsiz, hozircha bu ma'lumotni");
  const notFound = m.includes("topilmadi");
  const intent = d.intent || "?";
  let verdict;
  if (genericFail) verdict = "❌ GENERIC";
  else if (notFound) verdict = "⚠️ topilmadi";
  else verdict = "✅";

  if (!stageCounts[item.stage]) stageCounts[item.stage] = { ok: 0, warn: 0, fail: 0 };
  if (verdict === "✅") stageCounts[item.stage].ok++;
  else if (verdict === "⚠️ topilmadi") stageCounts[item.stage].warn++;
  else stageCounts[item.stage].fail++;

  const first = m.split("\n")[0]?.substring(0, 60) || "";
  results.push({ stage: item.stage, msg: item.msg, verdict, intent, first, ms: Date.now() - t0 });

  console.log(`${verdict} [${item.stage}] \"${item.msg}\" (${Date.now() - t0}ms) → ${intent} | ${first}`);
}

// ==== XULOSA ====
console.log("\n\n══════════════════════════════════");
console.log("📊 REAL USER JOURNEY XULOSASI");
console.log("══════════════════════════════════");
console.log(`JAMI: ${results.length} ta savol | ✅ OK: ${results.filter(r => r.verdict === "✅").length} | ⚠️ topilmadi: ${results.filter(r => r.verdict === "⚠️ topilmadi").length} | ❌ GENERIC: ${results.filter(r => r.verdict === "❌ GENERIC").length}`);

console.log("\n--- Bosqichlar bo'yicha ---");
for (const [stage, c] of Object.entries(stageCounts)) {
  console.log(`  ${stage}: ${c.ok}✅ / ${c.warn}⚠️ / ${c.fail}❌`);
}

console.log("\n--- ❌ GENERIC xatolar (eng muhim) ---");
results.filter(r => r.verdict === "❌ GENERIC").forEach(r => {
  console.log(`  [${r.stage}] "${r.msg}" → ${r.intent}`);
});

console.log("\n--- ⚠️ topilmadi (tolerant) ---");
results.filter(r => r.verdict === "⚠️ topilmadi").forEach(r => {
  console.log(`  [${r.stage}] "${r.msg}" → ${r.intent} | ${r.first}`);
});

// Sessiya ID si
console.log(`\nSESSIYA ID: ${sessionId}`);
