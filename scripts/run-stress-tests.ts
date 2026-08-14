/**
 * Mentalaba AI — 100 Stress Test Runner
 *
 * stress-tests.json dataset'idagi har bir conversation'ni local chat API'ga
 * ketma-ket yuboradi (har test uchun alohida guest session) va natijalarni
 * markdown report'ga yozadi.
 *
 * Ishlatish:
 *   cd backend
 *   CHAT_API_URL=http://localhost:3002/api/v1/chat npm run stress  (yoki npx tsx scripts/run-stress-tests.ts)
 *   CHAT_API_URL=... npx tsx scripts/run-stress-tests.ts --block 4   (faqat 4-blok)
 *   CHAT_API_URL=... npx tsx scripts/run-stress-tests.ts --ids 31,32,96
 *
 * Report: backend/scripts/stress-report.md (har xabar → javob + tekshiruvlar)
 */
import fs from "fs";
import path from "path";

interface StressTest {
  id: number;
  block: number;
  blockName: string;
  title: string;
  preConversation?: string[];
  conversation: string[];
  expected?: Record<string, any>;
  must_not?: string[];
}

interface Dataset {
  meta: any;
  tests: StressTest[];
}

const API_URL = process.env.CHAT_API_URL || "http://localhost:3002/api/v1/chat";
const GUEST_PREFIX = "stress-test";
// REPORT_FILE berilsa — report shu faylga yoziladi (parallel run'lar uchun)
const REPORT_FILE = process.env.REPORT_FILE || "stress-report.md";
// DATASET_FILE berilsa — boshqa dataset ishlatiladi (masalan uzun kontekstli
// testlar: DATASET_FILE=stress-tests-context.json).
const DATASET_FILE = process.env.DATASET_FILE || "stress-tests.json";

// AUTH_TOKEN berilsa — login qilingan user sifatida test qilinadi (paywall ochiladi):
//   AUTH_TOKEN="<access_token>" npx tsx scripts/run-stress-tests.ts
const AUTH_TOKEN = process.env.AUTH_TOKEN || "";
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || "";
// --ids 99 kabi guest rejimda ishlashini talab qiladigan testlar uchun
const REQUIRE_GUEST = process.env.REQUIRE_GUEST === "1";

/** 🔐 paywall javobi (login kerak) — bu agent xatosi emas, test muhiti cheklovi */
function isPaywall(text: string): boolean {
  return /(Mentalaba accountingizga kirishingiz kerak|login qilgan foydalanuvchilar|accountiga kirish)/.test(text);
}

// ===== CLI parametrlar =====
const args = process.argv.slice(2);
const blockArg = args.indexOf("--block");
const idsArg = args.indexOf("--ids");
let selectedBlocks: number[] = [];
let selectedIds: number[] = [];
if (blockArg !== -1) selectedBlocks = args[blockArg + 1]?.split(",").map(Number) || [];
if (idsArg !== -1) selectedIds = args[idsArg + 1]?.split(",").map(Number) || [];

async function sendMessage(
  message: string,
  guestId: string,
  sessionId?: string
): Promise<{ text: string; sessionId?: string; error?: string; status?: number }> {
  const body: any = { message, language: "uz" };
  if (sessionId) body.sessionId = sessionId;
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Guest-Id": guestId,
    };
    // requiresGuest=true bo'lgan testlarda (masalan #99 guest user) auth
    // header YUBORILMAYDI — token berilgan bo'lsa ham guest sifatida test qilinadi
    if (!REQUIRE_GUEST && AUTH_TOKEN) headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
    if (!REQUIRE_GUEST && REFRESH_TOKEN) headers["X-Refresh-Token"] = REFRESH_TOKEN;

    const res = await fetch(`${API_URL}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { text: "", error: json.error || `HTTP ${res.status}`, status: res.status };
    }
    return {
      text: json?.data?.message || "",
      sessionId: json?.data?.sessionId,
    };
  } catch (e: any) {
    return { text: "", error: `NETWORK: ${e?.message}` };
  }
}

// Universitet qisqartmalari → to'liq nomlar (test "TATU" kutsa, agent to'liq
// "Toshkent axborot texnologiyalari universiteti" deb yozishi mumkin — bu
// agent xatosi emas, moslashtirib tekshirish kerak).
const UNIVERSITY_ALIASES: Record<string, string[]> = {
  "tatu": ["toshkent axborot texnologiyalari", "tuit", "tat u"],
  "pdp": ["pdp university", "pdp"],
  "emu": ["emu", "emuniversitet", "emanuel"],
  "amity": ["amity"],
  "tta": ["toshkent tibbiyot akademiyasi"],
};

function normalizeUniName(name: string): string {
  const n = name.toLowerCase().trim();
  if (!n) return "";
  const aliases = UNIVERSITY_ALIASES[n];
  if (aliases) return aliases.join(" ");
  return n;
}

// ===== Oddiy heuristik tekshiruvlar (must_not / expected key'lari bo'yicha) =====
function checkMustNot(text: string, key: string): boolean {
  // true → MUAMMO (must_not buzilgan), false → OK
  const t = text.toLowerCase();
  switch (key) {
    case "ask_public_or_private":
      // SAVOL shakli ("davlatmi?"/"xususiymi?") — tavsiya shakli emas
      return /(davlatmi|xususiymi|davlat\s+yoki\s+xususiy\s*universitetmi|qaysi\s+kategoriya)/.test(t);
    case "recommend_public_first":
      return /(davlat\s+universitetlari|davlat\s+otm)[^.]{0,60}(tavsiya|birinch|eng\s+yaxshi)/.test(t) && /xususiy/.test(t) === false;
    case "random_university_list":
    case "university_recommendation":
    case "random_university_picked":
      return /(universitetlari|universitetlar|tavsiya)/.test(t) && /(tanlash|so'rang|aytib|qaysi)/.test(t) === false;
    case "university_reset":
    case "context_broken":
      return /(bilmayman|tushunmadim|aniq emas)/.test(t);
    case "return_generic_direction_search":
      return /(topildi|yo'nalish\s+topildi)/.test(t) && /(tavsiya|sizga\s+mos)/.test(t) === false;
    case "direction_search_only":
      return /(topildi|yo'nalishlari\s+bor)/.test(t) && /(tavsiya|sizga\s+mos)/.test(t) === false;
    case "full_university_dump":
      // Faqat oxirgi javobda tekshiriladi (runTest'da lastText uzatiladi) —
      // conversation boshida "PDP" so'ralganda to'liq karta normal javob.
      return /(telefon|sayt|manzil|kontrakt|yotoqxona|grant|yo'nalishlar soni)[^.]{0,300}(telefon|sayt|manzil|kontrakt|yotoqxona|grant|yo'nalishlar soni)/.test(t);
    case "clarification_asked":
    case "clarification_instead":
      return /(aytib\s+bering|qaysi\s+shahar|qaysi\s+yo'nalish|qaysi\s+universitet)/.test(t);
    case "random_university":
      // Juda keng emas: faqat qidiruv-chiplik belgilari bo'lsa flag'lanadi
      return /(universitetlar ro'yxati|mana sizga mos)/.test(t) && /(qaysi|aniqlashtir|so'rang)/.test(t) === false;
    case "invented_phone":
      return /\+998\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}/.test(t) && /(topilmadi|mavjud emas|ko'rsatilmagan)/.test(t) === false;
    case "invented_university":
      return /(XYZ|nomuvofiq|to'qilgan)/.test(t) && /topilmadi|mavjud emas/.test(t) === false;
    case "intent_broken":
      return /(tushunmadim|aniq emas)/.test(t);
    default:
      // noma'lum key — baholamaymiz (false = OK)
      return false;
  }
}

function checkExpected(text: string, expected: Record<string, any> | undefined): string[] {
  const problems: string[] = [];
  if (!expected) return problems;
  const t = text.toLowerCase();
  if (expected.needsClarification === true && !/(qaysi|aytib ber|aniqlashtir)/.test(t)) {
    problems.push("needsClarification=true kutilgan, lekin javobda clarification yo'q");
  }
  if (expected.needsClarification === false && /(qaysi\s+shahar|qaysi\s+yo'nalish|qaysi\s+universitet|aytib\s+bering)/.test(t)) {
    problems.push("needsClarification=false kutilgan, lekin javobda clarification bor");
  }
  if (
    expected.admissionFailed === true &&
    !/imtihon|kira olma|o'ta olma|o'tolma|yetma|yetmay|kirish imkoniyat|bunday holat|holatingizda|o'ta olmaslik|vaziyat|holatini hisobga/.test(t)
  ) {
    problems.push("admissionFailed=true kutilgan, javobda vaziyatga murojaat yo'q");
  }
  // STAGE 14g: privateFirst — vaziyatga murojaat bo'lsa ("imtihondan o'ta
  // olmaganingizni aytdingiz") yoki xususiy/xalqaro eslatilsa qanoatlanadi.
  // Clarification savolida "xususiy" so'zi bo'lmasa ham (masalan "Qaysi
  // yo'nalish?") — agent vaziyatni tan olgan bo'lsa to'g'ri javob.
  if (expected.privateFirst === true && !/xususiy|xalqaro|ochiq qabul|o'ta olmagan|o'ta olmaslik|bu o'qish imkoniyati yo'q degani emas|avvalo xususiy|avvalo xususiy va xalqaro/.test(t)) {
    problems.push("privateFirst kutilgan, javobda xususiy/xalqaro tavsiya yo'q");
  }
  if (expected.institutionCategory === "private" && !/(xususiy|xalqaro|sizga mos variantlar|mos variantlar)/.test(t)) {
    problems.push("institutionCategory=private kutilgan, javobda 'xususiy' yo'q");
  }
  if (expected.institutionCategory === "state" && !/(davlat|davlat universitetlar)/.test(t)) {
    problems.push("institutionCategory=state kutilgan, javobda 'davlat' yo'q");
  }
  if (expected.hostel === true && !/yotoqxona/.test(t)) {
    problems.push("hostel=true kutilgan, javobda 'yotoqxona' yo'q");
  }
  if (expected.grant === true && !/grant/.test(t)) {
    problems.push("grant=true kutilgan, javobda 'grant' yo'q");
  }
  if (expected.field === "tuition" && !/(kontrakt|to'lov|narx|summa)/.test(t)) {
    problems.push("field=tuition kutilgan, javobda kontrakt/narx yo'q");
  }
  if (expected.field === "phone" && !/telefon/.test(t)) {
    problems.push("field=phone kutilgan, javobda 'telefon' yo'q");
  }
  if (expected.field === "hostel" && !/yotoqxona/.test(t)) {
    problems.push("field=hostel kutilgan, javobda 'yotoqxona' yo'q");
  }
  if (expected.field === "website" && !/(sayt|web|site)/.test(t)) {
    problems.push("field=website kutilgan, javobda 'sayt' yo'q");
  }
  if (expected.field === "directions" && !/yo'nalish/.test(t)) {
    problems.push("field=directions kutilgan, javobda 'yo'nalish' yo'q");
  }
  if (expected.field === "email" && !/email|@/.test(t)) {
    problems.push("field=email kutilgan, javobda 'email' yo'q");
  }
  if (expected.field === "address" && !/manzil|viloyat|shahar/.test(t)) {
    problems.push("field=address kutilgan, javobda 'manzil' yo'q");
  }
  if (expected.field === "admission" && !/(qabul|kirish|hujjat)/.test(t)) {
    problems.push("field=admission kutilgan, javobda 'qabul' yo'q");
  }
  if (
    expected.noHallucination === true &&
    /\+998\s?\d{2}/.test(t) &&
    /(topilmadi|mavjud emas|ko'rsatilmagan)/.test(t) === false
  ) {
    problems.push("noHallucination kutilgan, lekin javobda telefon raqam to'qilgan bo'lishi mumkin");
  }
  if (expected.guestMode === true) {
    // Guest rejimda 2 xil to'g'ri javob bo'lishi mumkin:
    // 1) login taklifi (paywall)  2) clarification (keyin paywall chiqadi)
    const hasLoginHint = /(kirish|account|login|hisobingizga kiring)/.test(t);
    const hasClarification = /(qaysi\s+shahar|qaysi\s+yo'nalish|qaysi\s+universitet|davlatmi|davlat\s+yoki\s+xususiy)/.test(t);
    if (!hasLoginHint && !hasClarification) {
      problems.push("guestMode kutilgan — login taklifi yoki clarification bo'lishi kerak");
    }
  }
  if (expected.typoHandled === true && /(tushunmadim|noto'g'ri|error)/.test(t)) {
    problems.push("typoHandled kutilgan, lekin javob typo'ni tushunmadi");
  }
  if (expected.lastUniversity) {
    // Qisqartma (TATU) yoki to'liq nom (Toshkent axborot texnologiyalari) mosligi
    const expectedName = normalizeUniName(String(expected.lastUniversity));
    const names = expectedName ? expectedName.split(" ") : [String(expected.lastUniversity).toLowerCase()];
    const ok = names.some((part) => part.length > 2 && t.includes(part));
    if (!ok) {
      problems.push(`lastUniversity=${expected.lastUniversity} kutilgan, javobda yo'q`);
    }
  }
  return problems;
}

async function runTest(test: StressTest, guestId: string) {
  const allMessages = [...(test.preConversation || []), ...test.conversation];
  const turns: { user: string; assistant: string; error?: string }[] = [];
  let sessionId: string | undefined;

  for (const msg of allMessages) {
    const res = await sendMessage(msg, guestId, sessionId);
    if (res.sessionId) sessionId = res.sessionId;
    turns.push({
      user: msg,
      assistant: res.error ? `[${res.status || "ERR"}] ${res.error}` : res.text,
      error: res.error,
    });
  }

  // Tekshiruvlar
  const lastText = turns[turns.length - 1]?.assistant || "";
  const allText = turns.map((t) => t.assistant).join("\n");

  // must_not'lar: conversation bo'ylab (allText) tekshiriladi, lekin
  // full_university_dump faqat oxirgi javobda (o'rta javoblar normal bo'lishi mumkin)
  const mustNotViolations = (test.must_not || []).filter((k) =>
    k === "full_university_dump" ? checkMustNot(lastText, k) : checkMustNot(allText, k)
  );
  // expected.scope="all" bo'lsa — tekshiruv butun konversatsiya bo'ylab
  // (allText), aks holda faqat oxirgi javobda. E2E uzun zanjirlarda profile
  // tekshiruvlari (admissionFailed/privateFirst/hostel/grant) o'rtadagi
  // tavsiya javobida bo'lishi mumkin — oxirgi javob field javobi bo'lsa ham
  // context saqlanishi tekshiriladi.
  const expectedProblems = checkExpected(
    test.expected?.scope === "all" ? allText : lastText,
    test.expected
  );
  const errors = turns.filter((t) => t.error).map((t) => `${t.user} → ${t.error}`);
  // 🔐 paywall — agent xatosi emas (guest rejimda university data yopiq).
  // AUTH_TOKEN berib qayta ishga tushirish kerak.
  const paywalled = turns.some((t) => isPaywall(t.assistant));

  const passed =
    mustNotViolations.length === 0 &&
    expectedProblems.length === 0 &&
    errors.length === 0 &&
    !paywalled;

  return {
    test,
    turns,
    passed,
    paywalled,
    mustNotViolations,
    expectedProblems,
    errors,
  };
}

function renderReport(results: Awaited<ReturnType<typeof runTest>>[]): string {
  const passed = results.filter((r) => r.passed).length;
  const lines: string[] = [];
  lines.push(`# Mentalaba AI — Stress Test Report`);
  lines.push(``);
  lines.push(`> ⚠️ must_not/expected tekshiruvlari **indikativ** — haqiqiy baho uchun har bir javob matnini ko'rib chiqish kerak. 🔐 = login paywall (agent xatosi emas).`);
  lines.push(``);
  lines.push(`- **Sana:** ${new Date().toISOString()}`);
  lines.push(`- **API:** ${API_URL}`);
  lines.push(`- **Natija:** ${passed}/${results.length} ✅`);
  lines.push(``);

  let currentBlock = 0;
  for (const r of results) {
    if (r.test.block !== currentBlock) {
      currentBlock = r.test.block;
      lines.push(`## ${currentBlock}. ${r.test.blockName}`);
      lines.push(``);
    }
    const status = r.passed ? "✅" : r.paywalled ? "🔐" : "❌";
    lines.push(`### ${status} #${r.test.id} — ${r.test.title}`);
    if (r.paywalled && !r.passed) {
      lines.push(`> 🔐 Login paywall — AUTH_TOKEN berib qayta ishga tushiring: \`AUTH_TOKEN=... npx tsx scripts/run-stress-tests.ts\``);
      lines.push(``);
    }
    lines.push(``);
    r.turns.forEach((t, i) => {
      const isLast = i === r.turns.length - 1;
      lines.push(`**User:** ${t.user}`);
      lines.push(``);
      const snippet = t.assistant.length > 600 ? t.assistant.slice(0, 600) + "…" : t.assistant;
      lines.push(`> ${snippet.split("\n").join("\n> ")}`);
      lines.push(``);
      if (isLast && t.error) lines.push(`⚠️ XATO: ${t.error}`);
    });
    if (r.mustNotViolations.length) {
      lines.push(`🚫 must_not buzilgan: ${r.mustNotViolations.join(", ")}`);
    }
    if (r.expectedProblems.length) {
      lines.push(`⚠️ kutilgan holat mos emas: ${r.expectedProblems.join("; ")}`);
    }
    lines.push(``);
  }
  return lines.join("\n");
}

async function main() {
  const datasetPath = path.join(__dirname, DATASET_FILE);
  const dataset: Dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));

  let tests = dataset.tests;
  if (selectedBlocks.length) tests = tests.filter((t) => selectedBlocks.includes(t.block));
  if (selectedIds.length) tests = tests.filter((t) => selectedIds.includes(t.id));

  if (!tests.length) {
    console.error("Tanlangan testlar topilmadi. --block 4 yoki --ids 31,32 ishlating.");
    process.exit(1);
  }

  // Noma'lum must_not keylar — typo bo'lsa ogohlantir (sekin-asta buzilmasin)
  const KNOWN_MUST_NOT = [
    "ask_public_or_private", "recommend_public_first", "random_university_list",
    "university_recommendation", "random_university_picked", "university_reset",
    "context_broken", "return_generic_direction_search", "direction_search_only",
    "full_university_dump", "clarification_asked", "state_universities_included",
    "private_universities_included", "any_filter_ignored", "budget_ignored",
    "expensive_recommendation_first", "language_ignored", "state_only_recommended",
    "expensive_first", "farmatsiya_included", "category_expansion_mixed",
    "all_it_mixed", "universities_without_that_direction", "region_ignored",
    "category_ignored", "over_budget_recommended", "hostel_ignored",
    "no_grant_universities_only", "davolash_ishi_locked", "dasturlash_only",
    "pdp_context_stuck", "new_search_instead", "first_item_returned",
    "same_result_repeated", "same_university_recommended", "same_list_repeated",
    "tat_u_kept", "pdp_kept", "men_emu_false_entity", "tat_u_replaced_by_other_university",
    "tat_u_kept_as_answer", "private_first_override_explicit",
    "private_first_overrides_explicit_state", "public_first_recommendation",
    "wrong_university_after_repair", "any_preference_lost", "clarification_instead",
    "toshkent_kept", "toshkent_it_profile_kept", "treated_as_general_chat_only",
    "only_empathy_no_action", "unrequested_recommendation",
    "university_recommendation_without_context", "tibbiyot_ignored", "samarqand_as_preferred_city",
    "random_university", "only_cheapest_no_quality", "silent_contradiction", "hard_state_only",
    // v2 bloklaridan yangi kalitlar
    "state_first", "state_default", "recommend_state_first", "generic_chat_only",
    "amity_kept", "unrelated_direction", "single_result_only", "toshkent_used",
    "direction_ignored", "grant_ignored", "admission_ignored", "repair_mistake",
    "state_ignored", "guest_data_leak", "invented_phone", "invented_university",
    "invented_data", "invented_tuition", "confirmation_without_data",
    "invented_grant", "blind_confirmation", "intent_broken", "pdp_selected",
    "unrequested_private_data",
  ];
  const unknownKeys = new Set<string>();
  for (const t of tests) {
    for (const k of t.must_not || []) {
      if (!KNOWN_MUST_NOT.includes(k)) unknownKeys.add(k);
    }
  }
  if (unknownKeys.size) {
    console.warn(`⚠️ Tanilmagan must_not key(lar): ${[...unknownKeys].join(", ")} — tekshiruv o'tkazib yuboriladi!`);
  }

  console.log(`📡 API: ${API_URL}`);
  console.log(`🔑 Auth: ${REQUIRE_GUEST ? "GUEST rejim (REQUIRE_GUEST=1 — auth header yuborilmaydi)" : AUTH_TOKEN ? "login qilingan (AUTH_TOKEN)" : "GUEST rejim — paywall bo'lishi mumkin"}`);
  console.log(`🧪 Testlar: ${tests.length} ta (block=${selectedBlocks.join(",") || "hammasi"})`);
  console.log(`⏳ Ishga tushmoqda...\n`);

  const results: Awaited<ReturnType<typeof runTest>>[] = [];
  for (const test of tests) {
    const guestId = `${GUEST_PREFIX}-${test.id}-${Date.now()}`;
    const r = await runTest(test, guestId);
    results.push(r);
    const mark = r.passed ? "✅" : r.paywalled ? "🔐" : "❌";
    console.log(`  ${mark} #${test.id} ${test.title}` + (r.passed ? "" : ` — ${[...r.mustNotViolations, ...r.expectedProblems].join("; ") || r.errors[0] || (r.paywalled ? "paywall" : "")}`));
  }

  const reportPath = path.join(__dirname, REPORT_FILE);
  fs.writeFileSync(reportPath, renderReport(results), "utf-8");

  const passed = results.filter((r) => r.passed).length;
  console.log(`\n📊 NATIJA: ${passed}/${results.length} ✅`);
  console.log(`📄 Report: ${reportPath}`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error("Runner xatosi:", e);
  process.exit(1);
});
