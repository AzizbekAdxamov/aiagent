// ============================================================
// 3001 template server stress test — 1 ta chat session'da 82 savol
// AI o'chirilgan (AI_MODE=template) — javoblar shablon orqali
// ============================================================
const BASE = "http://localhost:3001/api/v1/chat";
let sessionId = null;

const CATEGORIES = [
  {
    name: "1. Universitet qidirish",
    steps: [
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
    steps: [
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
    name: "3. Follow-up (context test)",
    steps: [
      "Toshkentdagi universitetlar",
      "ITlari",
      "Davlatlari",
      "Ingliz tilidagilari",
      "Kontrakti qancha",
    ],
  },
  {
    name: "4. Grant",
    steps: [
      "Grantlar bormi",
      "100 foizlik grantlar",
      "Davlat granti",
      "Xorijiy grantlar",
      "Grantga qanday topshiraman",
    ],
  },
  {
    name: "5. Yangiliklar",
    steps: [
      "Bugungi yangiliklar",
      "So'nggi ta'lim yangiliklari",
      "Abituriyentlar uchun yangiliklar",
      "Grant yangiliklari",
    ],
  },
  {
    name: "6. Universitet haqida",
    steps: [
      "TATU haqida ma'lumot",
      "Amity universiteti",
      "Westminster haqida",
      "Toshkent tibbiyot akademiyasi",
    ],
  },
  {
    name: "7. Kontrakt",
    steps: [
      "TATU kontrakti",
      "IT yo'nalishi kontrakti",
      "Eng arzon universitet",
      "20 milliongacha kontrakti bor universitet",
    ],
  },
  {
    name: "8. Tabiiy gaplashish",
    steps: [
      "Men shifokor bo'lmoqchiman",
      "Kelajakda AI bilan ishlamoqchiman",
      "Kompyuterni yaxshi ko'raman",
      "Matematikam yaxshi",
      "Biologiyani yaxshi ko'raman",
    ],
  },
  {
    name: "9. Sinonimlar",
    steps: ["Meditsina", "Vrachlik", "Doktorlik", "Shifokorlik"],
  },
  {
    name: "10. Xato yozilgan so'zlar",
    steps: [
      "Toshkentda universtitlar",
      "Tibiyot",
      "Dasturlaw",
      "Kompyutr",
      "Grantla",
    ],
  },
  {
    name: "11. Aralash so'rovlar",
    steps: [
      "Toshkentdagi IT universitetlari",
      "Samarqanddagi tibbiyot universitetlari",
      "Davlat IT universitetlari",
      "Ingliz tilidagi tibbiyot yo'nalishlari",
      "Magistratura uchun AI yo'nalishlari",
    ],
  },
  {
    name: "12. Solishtirish",
    steps: [
      "TATU va INHA ni solishtir",
      "Amity yoki Westminster",
      "Davlatmi yoki xususiymi",
    ],
  },
  {
    name: "13. Noaniq savollar",
    steps: [
      "Qaysi biri yaxshi",
      "Menga mosi qaysi",
      "Nimani tavsiya qilasan",
      "Qayerga topshirsam yaxshi",
    ],
  },
  {
    name: "14. Stress / oddiy foydalanuvchi",
    steps: [
      "salom",
      "oka yordam bering",
      "men nima o'qisam ekan",
      "pulim kam",
      "kontrakti arzonroq joy kerak",
      "ota-onam shifokor bo'lishimni xohlaydi",
      "informatikani yaxshi ko'raman",
      "xorijga ketmoqchiman",
      "IELTS 6.5 bor",
      "grant yutmoqchiman",
      "o'qishga kira olamanmi",
      "men toshkenda o'qimoqchiman",
      "doktor bo'lmoqchiman",
    ],
  },
];

const BAD_PATTERNS = [
  "topa olmadim",
  "bog.lanishda xatolik",
  "Internal server error",
  "xatolik yuz berdi",
  "undefined",
];

let total = 0;
let ok = 0;
let bad = 0;
let questions = 0;
const failures = [];

for (const cat of CATEGORIES) {
  console.log(`\n${"=".repeat(64)}`);
  console.log(`  ${cat.name}  (${cat.steps.length} savol)`);
  console.log(`${"=".repeat(64)}`);
  for (const step of cat.steps) {
    total++;
    const body = { message: step, language: "uz" };
    if (sessionId) body.sessionId = sessionId;
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 60000);
      const res = await fetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(to);
      const j = await res.json();
      const d = j.data || {};
      sessionId = d.sessionId || sessionId;
      const m = d.message || "";
      const firstLine = m.split("\n").find((l) => l.trim()) || "";
      const isQuestion =
        /(qaysi shahar|qanday yo'nalish|savolga javob bering|qaysi biri sizni qiziqtiradi|yordam bera olaman|nimani o'qimoqchisiz|bitta chat)/i.test(
          m
        );
      const isBad = BAD_PATTERNS.some((p) => m.toLowerCase().includes(p));

      if (isBad) {
        bad++;
        failures.push({ step, intent: d.intent, msg: m.substring(0, 150) });
        console.log(`  ❌ "${step}" -> ${d.intent} | ${firstLine.substring(0, 90)}`);
      } else if (isQuestion) {
        questions++;
        console.log(`  ❓ "${step}" -> ${d.intent} (savol — to'g'ri) | ${firstLine.substring(0, 90)}`);
      } else {
        ok++;
        console.log(`  ✅ "${step}" -> ${d.intent} | ${firstLine.substring(0, 90)}`);
      }
    } catch (e) {
      bad++;
      failures.push({ step, intent: "ERR", msg: e.message });
      console.log(`  ⛔ "${step}" -> ERR: ${e.message.substring(0, 80)}`);
    }
  }
}

console.log(`\n${"=".repeat(64)}`);
console.log(`  JAMI: ${total} | ✅ To'g'ri javob: ${ok} | ❓ Savol (to'g'ri): ${questions} | ❌ Xato: ${bad}`);
console.log(`${"=".repeat(64)}`);
if (failures.length > 0) {
  console.log("\n--- ❌ XATOLAR RO'YXATI ---");
  for (const f of failures) {
    console.log(`  • "${f.step}" [${f.intent}]: ${f.msg.substring(0, 120)}`);
  }
}
