// ============ FULL STRESS TEST — Mentalaba AI agent ============
// 14 kategoriya + suhbat uslubi — jami 70+ savol
const BASE = "http://localhost:3000/api/v1/chat";

const CATEGORIES = [
  {
    name: "1. Universitet qidirish",
    tests: [
      "Toshkentdagi universitetlar",
      "Samarqanddagi davlat universitetlari",
      "Xususiy universitetlar kerak",
      "Xalqaro universitetlar",
      "Tibbiyot universitetlari",
      "Eng yaxshi IT universitetlari",
      "Kontrakti arzon universitetlar",
      "Ingliz tilida o'qitadigan universitetlar",
      "Magistratura bor universitetlar",
      "Sirtqi ta'lim bormi",
    ],
  },
  {
    name: "2. Yo'nalish qidirish",
    tests: [
      "Qanday yo'nalishlar mavjud",
      "IT yo'nalishlari",
      "Tibbiyot yo'nalishlari",
      "Huquq yo'nalishlari",
      "Iqtisod yo'nalishlari",
      "Pedagogika yo'nalishlari",
      "Sun'iy intellekt yo'nalishi bormi",
      "Stomatologiya qayerlarda bor",
      "Farmatsiya qaysi universitetlarda bor",
      "Dasturlash yo'nalishi",
    ],
  },
  {
    name: "3. Follow-up zanjiri (session)",
    chain: true,
    tests: [
      "Toshkentdagi universitetlar",
      "ITlari",
      "Davlatlari",
      "Ingliz tilidagilari",
      "Kontrakti qancha",
    ],
  },
  {
    name: "4. Grant",
    tests: [
      "Grantlar bormi",
      "100 foizlik grantlar",
      "Davlat granti",
      "Xorijiy grantlar",
      "Grantga qanday topshiraman",
    ],
  },
  {
    name: "5. Yangiliklar",
    tests: [
      "Bugungi yangiliklar",
      "So'nggi ta'lim yangiliklari",
      "Abituriyentlar uchun yangiliklar",
      "Grant yangiliklari",
    ],
  },
  {
    name: "6. Universitet haqida",
    tests: [
      "TATU haqida ma'lumot",
      "Amity universiteti",
      "Westminster haqida",
      "Toshkent tibbiyot akademiyasi",
    ],
  },
  {
    name: "7. Kontrakt",
    tests: [
      "TATU kontrakti",
      "IT yo'nalishi kontrakti",
      "Eng arzon universitet",
      "20 milliongacha kontrakti bor universitet",
    ],
  },
  {
    name: "8. Tabiiy gaplashish",
    tests: [
      "Men shifokor bo'lmoqchiman",
      "Kelajakda AI bilan ishlamoqchiman",
      "Kompyuterni yaxshi ko'raman",
      "Matematikam yaxshi",
      "Biologiyani yaxshi ko'raman",
    ],
  },
  {
    name: "9. Sinonimlar",
    tests: [
      "Meditsina",
      "Vrachlik",
      "Doktorlik",
      "Shifokorlik",
    ],
  },
  {
    name: "10. Xato yozilgan so'zlar",
    tests: [
      "Toshkentda universtitlar",
      "Tibiyot",
      "Dasturlaw",
      "Kompyutr",
      "Grantla",
    ],
  },
  {
    name: "11. Aralash so'rovlar",
    tests: [
      "Toshkentdagi IT universitetlari",
      "Samarqanddagi tibbiyot universitetlari",
      "Davlat IT universitetlari",
      "Ingliz tilidagi tibbiyot yo'nalishlari",
      "Magistratura uchun AI yo'nalishlari",
    ],
  },
  {
    name: "12. Solishtirish",
    tests: [
      "TATU va INHA ni solishtir",
      "Amity yoki Westminster",
      "Davlatmi yoki xususiymi",
    ],
  },
  {
    name: "13. Noaniq savollar",
    tests: [
      "Qaysi biri yaxshi",
      "Menga mosi qaysi",
      "Nimani tavsiya qilasan",
      "Qayerga topshirsam yaxshi",
    ],
  },
  {
    name: "14. Context testi (session)",
    chain: true,
    tests: [
      "Toshkent",
      "IT",
      "Davlat",
      "Faqat ingliz tilida",
      "Kontrakti 25 milliongacha",
    ],
  },
  {
    name: "15. Suhbat uslubi (stress)",
    tests: [
      "salom",
      "oka yordam bering",
      "men nima o'qisam ekan",
      "pulim kam",
      "kontrakti arzonroq joy kerak",
      "ota-onam shifokor bo'lishimni xohlaydi",
      "informatikani yaxshi ko'raman",
      "matematikam zo'r emas",
      "xorijga ketmoqchiman",
      "IELTS 6.5 bor",
      "grant yutmoqchiman",
      "o'qishga kira olamanmi",
    ],
  },
];

// Intent bo'yicha kutilgan "yaxshi" natijalar (faqat fikr uchun — hammasi ham aniq bo'lishi shart emas)
const GOOD_INTENTS = new Set([
  "university_search", "university_list", "university_detail",
  "direction_search", "direction_list",
  "grant_search", "grant_list",
  "news_search", "news_list",
  "tuition_search",
  "comparison",
  "recommendation",
  "greeting", "admission", "transfer",
]);

function verdict(d) {
  const msg = d.message || "";
  const hasData = msg.includes("universitet") || msg.includes("yo'nalish") || msg.includes("grant") ||
    msg.includes("yangilik") || msg.includes("ta tavsiya") || msg.includes("bor!") || /\d+ ta/.test(msg);
  const isFallback = msg.includes("topa olmadim") || msg.includes("topilmadi") || msg.includes("Kechirasiz");
  const isClarify = msg.includes("savolga javob bering") || msg.includes("Qaysi shahar");
  if (isClarify) return "❓(savol)";
  if (isFallback && !hasData) return "❌";
  return "✅";
}

let total = 0, ok = 0, fail = 0, clarify = 0;
const failures = [];

async function send(q, sid) {
  const body = { message: q, language: "uz" };
  if (sid) body.sessionId = sid;
  const res = await fetch(BASE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json();
  if (!j.success) return { d: null, sid: null };
  const d = j.data;
  return { d, sid: d.sessionId };
}

for (const cat of CATEGORIES) {
  console.log(`\n═══ ${cat.name} ═══`);
  let sid = null;
  for (const q of cat.tests) {
    total++;
    const { d, sid: newSid } = await send(q, cat.chain ? sid : undefined);
    if (cat.chain) sid = newSid;
    if (!d) { fail++; failures.push({ cat: cat.name, q, r: "ERROR: no response" }); console.log(`  ❌ "${q}" → ERROR`); continue; }
    const v = verdict(d);
    const first = (d.message || "").split("\n").find(l => l.trim()) || "";
    console.log(`  ${v} "${q}" → ${d.intent} | ${first.substring(0, 70)}`);
    if (v === "✅") ok++;
    else if (v === "❓(savol)") clarify++;
    else { fail++; failures.push({ cat: cat.name, q, r: `${d.intent}: ${first.substring(0, 80)}` }); }
    await new Promise(r => setTimeout(r, 250));
  }
}

console.log(`\n\n══════════════════════════════════════`);
console.log(`JAMI: ${total} | ✅ ${ok} | ❓(savol) ${clarify} | ❌ ${fail}`);
console.log(`\n--- ❌ FAILURES ---`);
for (const f of failures) console.log(`  [${f.cat}] "${f.q}" → ${f.r}`);
