/**
 * STAGE 14 TEST — Exact Direction Resolution + User State (admission_failed)
 * ISHLATISH: cd backend && npx tsx scripts/test-exact-direction.ts
 */
import { detectExactDirection, hasExactDirection } from "../src/ai-agent/exact-direction";
import { extractAdmissionFailed } from "../src/ai-agent/entity-extractor";
import { intentClassifier } from "../src/ai-agent/intent-classifier";
import { resolveQuery } from "../src/ai-agent/query-resolver";

let ok = true;
const check = (label: string, actual: any, expected: any) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) ok = false;
  console.log(`${pass ? "✅" : "❌"} ${label}: got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
};

console.log("=== EXACT DIRECTION DETECTION ===");
check("davolash ishiga", detectExactDirection("davolash ishiga"), "davolash ishi");
check("men davolash ishi o'qimoqchiman", detectExactDirection("men davolash ishi o'qimoqchiman"), "davolash ishi");
check("davolash ishi haqida ma'lumot", detectExactDirection("davolash ishi haqida ma'lumot"), "davolash ishi");
check("stomatologiya", detectExactDirection("stomatologiya"), "stomatologiya");
check("farmatsiya", detectExactDirection("farmatsiya"), "farmatsiya");
check("tibbiyotga qiziqaman", detectExactDirection("tibbiyotga qiziqaman"), null); // kategoriya
check("tibbiyot", detectExactDirection("tibbiyot"), null); // kategoriya
check("kompyuter injiniringi", detectExactDirection("kompyuter injiniringi"), "kompyuter injiniringi");
check("IT ga qiziqaman", detectExactDirection("IT ga qiziqaman"), null); // kategoriya
check("has: davolash ishi", hasExactDirection("davolash ishi qayerda bor"), true);
check("has: tibbiyot", hasExactDirection("tibbiyot"), false);

console.log("\n=== CAREER → EXACT DIRECTION (STAGE 14d) ===");
check("doktor bo'lishni xohlayman", detectExactDirection("men doktor bo'lishni xohlayman"), "davolash ishi");
check("doktor bo'lishni orzu qilaman", detectExactDirection("men yoshligimdan doktor bo'lishni orzu qilaman"), "davolash ishi");
check("shifokor bo'lmoqchiman", detectExactDirection("shifokor bo'lmoqchiman, Toshkentda yashayman"), "davolash ishi");
check("vrach", detectExactDirection("vrach bo'lmoqchiman"), "davolash ishi");
check("stomatolog bo'lmoqchiman", detectExactDirection("stomatolog bo'lmoqchiman"), "stomatologiya");
check("farmatsevt bo'lishni xohlayman", detectExactDirection("farmatsevt bo'lishni xohlayman"), "farmatsiya");
check("jarroh bo'lmoqchiman", detectExactDirection("jarroh bo'lmoqchiman"), "jarrohlik");
check("doktorantura → EMAS", detectExactDirection("doktorantura o'qimoqchiman"), null);
check("phd → EMAS", detectExactDirection("phd darajasini olishni xohlayman"), null);
check("doktorlik → EMAS", detectExactDirection("doktorlik dissertatsiyasi himoya qilmoqchiman"), null);

console.log("\n=== ADMISSION FAILED EXTRACTOR ===");
check("imtihondan yiqildim", extractAdmissionFailed("men bu yil imtihondan yiqildim"), true);
check("o'qishga kira olmadim", extractAdmissionFailed("o'qishga kira olmadim"), true);
check("ballim yetmadi", extractAdmissionFailed("ballim yetmadi"), true);
check("grantga kira olmadim", extractAdmissionFailed("grantga kira olmadim"), true);
check("normal gap", extractAdmissionFailed("Toshkentda yashayman, doktor bo'lmoqchiman"), false);
check("qiqishga kirdim", extractAdmissionFailed("o'qishga kirdim"), false);

console.log("\n=== QUERY RESOLVER BILAN BIRGA ===");
const cases = [
  "davolash ishiga o'qimoqchiman",
  "davolash ishi haqida koproq malumot",
  "men doktor bolishni orzu qilaman",
];
for (const msg of cases) {
  const it = intentClassifier.classify(msg);
  const q = resolveQuery(msg, it);
  const exact = detectExactDirection(msg);
  console.log(`[${msg}]`);
  console.log(`  intent=${it.intent} queryType=${q.type} exact=${exact || "-"}`);
}

console.log(`\n${ok ? "=== HAMMASI O'TDI ✅ ===" : "=== XATOLAR BOR ❌ ==="}`);
process.exit(ok ? 0 : 1);
