/**
 * MENTALABA AI — RESPONSE QUALITY REGRESSION TESTI (Stage 15c)
 *
 * Intent/Policy testlari "agent nima qaror qiladi?" ni tekshiradi. Bu test
 * esa "javob qanday beriladi?" — LLM javobining SIFATINI tekshiradi:
 *
 *   - TEMPLATE-HID: javobda shablon markerlari bo'lmasligi kerak
 *     (❌ "Keling, sizga mos variantni birga topamiz!", "1️⃣ Qaysi shahar?",
 *     "so'roviga mos N ta universitet topildi")
 *   - SUPPORTIVE: vaziyatga mos, qo'llab-quvvatlovchi ton (admissionFailed
 *     user uchun "xavotir olmang", "tushunaman" kabi)
 *   - Vaziyat tushunilgan: admissionFailed bo'lsa davlatni birinchi variant
 *     qilib tavsiya qilmaslik (private-first til)
 *
 * Ishlatish (server ishlashi kerak + AUTH_TOKEN):
 *   cd backend
 *   npx tsx scripts/regression-quality.ts
 *
 * Chiqish kodi: 0 = hammasi o'tdi, 1 = muvaffaqiyatsiz.
 *
 * MUHIM: LLM javoblari beqaror (bepul modellar) — mezonlar javob
 * o'zgarishiga chidamli, lekin TEMPLATE-HID deterministik (marker aniq).
 */
import fs from "fs";

const API_URL = process.env.CHAT_API_URL || "http://localhost:3000/api/v1/chat";
const TOKEN = process.env.AUTH_TOKEN || (() => {
  try {
    const d = JSON.parse(fs.readFileSync(".test-tokens.json", "utf8"));
    return d.token || d.data?.token || "";
  } catch {
    return "";
  }
})();

interface QualityScenario {
  label: string;
  message: string;
  /** Vaziyat: admissionFailed — javobda xususiy/alternativa ruhida bo'lishi kerak */
  admissionFailed?: boolean;
  /** Javobda bo'lishi kerak bo'lgan so'zlar (kamida bittasi) */
  mustContainOneOf?: string[];
  /** Javobda bo'lishi kerak bo'lgan aniq so'z */
  mustContain?: string[];
}

const SCENARIOS: QualityScenario[] = [
  {
    label: "yiqildim + IT o'qimoqchiman",
    message: "men bu yil imtihondan yiqildim, lekin ITda o'qishni xohlayman",
    admissionFailed: true,
    mustContain: ["IT"],
    mustContainOneOf: ["xususiy", "alternativa", "imkoniyat", "variant"],
  },
  {
    label: "Toshkent + tibbiyot tavsiya",
    message: "Toshkentda yashayman, tibbiyotga qiziqaman, qaysi universitetni tavsiya qilasan?",
    mustContainOneOf: ["tibbiyot", "Toshkent"],
  },
  {
    label: "davlat imtihonidan o'tdim, qaysi universitet bilmayman",
    message: "davlat imtihonlaridan o'tdim, qaysi universitet tanlashni bilmay qoldim",
    mustContainOneOf: ["yordam", "tushunaman", "tanlash", "bilmay"],
  },
];

/** Template markerlari — javobda bulari bo'lsa, javob "script yodlab olgan" */
const TEMPLATE_MARKERS = [
  /Keling,\s+sizga\s+mos\s+variantni\s+birga\s+topamiz/i,
  /so'roviga\s+mos\s+\d+\s+ta\s+universitet(?:da\s+yo'nalish)?\s+topildi/i,
  /Sizga\s+mos\s+universitetlar/i,
  /Javob\s+bering,\s+men\s+sizga\s+mos\s+variantlarni\s+topib\s+beraman/i,
  /^\s*1️⃣\s+Qaysi\s+shahar/i,
];

/** Supportive markerlar — admissionFailed user uchun qo'llab-quvvatlash */
const SUPPORTIVE_MARKERS = [
  /xavotir\s+olmang/i,
  /tushunaman/i,
  /yordam\s+ber/i,
  /tabriklayman/i,
  /albatta/i,
  /hech\s+qachon\s+taslim/i,
  /imkoniyat/i,
  /yo'qolgani\s+yo'q/i,
];

let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail: string): void {
  const mark = ok ? "✅" : "❌";
  console.log(`${mark} ${name}`);
  console.log(`   ${detail}`);
  if (ok) pass++;
  else fail++;
}

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("RESPONSE QUALITY TESTI — LLM javob sifati");
  console.log("=".repeat(60));

  if (!TOKEN) {
    console.log("❌ AUTH_TOKEN topilmadi (.test-tokens.json yoki env)");
    process.exit(1);
  }

  for (const s of SCENARIOS) {
    console.log("");
    console.log(`--- ${s.label} ---`);
    let msg = "";
    try {
      const sessionId = "quality-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` },
        body: JSON.stringify({ message: s.message, sessionId }),
      });
      const data = await res.json();
      msg = data.data?.message || "";
      console.log(`   javob: ${msg.replace(/\n/g, " ").slice(0, 220)}...`);
    } catch (e: any) {
      console.log(`   XATO: ${e.message}`);
      check(`[${s.label}] API ishladi`, false, "server javob bermadi");
      continue;
    }

    // 1) Template-hid
    const templateHit = TEMPLATE_MARKERS.find((m) => m.test(msg));
    check(
      `[${s.label}] template-hid (shablon markeri yo'q)`,
      !templateHit,
      templateHit ? `❌ marker topildi: ${templateHit}` : "javob tabiiy ko'rinadi"
    );

    // 2) mustContain (aniq so'zlar)
    if (s.mustContain?.length) {
      const missing = s.mustContain.filter((w) => !msg.toLowerCase().includes(w.toLowerCase()));
      check(
        `[${s.label}] mustContain: ${s.mustContain.join(", ")}`,
        missing.length === 0,
        missing.length === 0 ? "barchasi bor" : `❌ yetishmayapti: ${missing.join(", ")}`
      );
    }

    // 3) mustContainOneOf
    if (s.mustContainOneOf?.length) {
      const hit = s.mustContainOneOf.find((w) => msg.toLowerCase().includes(w.toLowerCase()));
      check(
        `[${s.label}] kontekst so'zlari: ${s.mustContainOneOf.join(" | ")}`,
        !!hit,
        hit ? `✅ topildi: ${hit}` : "❌ hech biri yo'q"
      );
    }

    // 4) Supportive ton (admissionFailed user uchun)
    if (s.admissionFailed) {
      const supportive = SUPPORTIVE_MARKERS.some((m) => m.test(msg));
      check(
        `[${s.label}] supportive ton (yiqilgan user uchun)`,
        supportive,
        supportive ? "qo'llab-quvvatlash bor" : "❌ quruq/robot javob (supportive marker yo'q)"
      );
    }
  }

  console.log("");
  console.log("=".repeat(60));
  console.log(`NATIJA: ${pass} o'tdi, ${fail} muvaffaqiyatsiz`);
  console.log("=".repeat(60));
  process.exit(fail > 0 ? 1 : 0);
}

void main();
