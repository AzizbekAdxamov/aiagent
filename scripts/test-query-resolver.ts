/**
 * QUERY RESOLVER TEST (BOSQICH 14) — API chaqiruvsiz, tez.
 * ISHLATISH: cd backend && npx tsx scripts/test-query-resolver.ts
 */
import { intentClassifier } from "../src/ai-agent/intent-classifier";
import { resolveQuery, isDirectionDetailRequest } from "../src/ai-agent/query-resolver";
import { formatDirectionDetail } from "../src/ai-agent/formatter/direction";

const cases = [
  "davolash ishi haqida koproq malumot bera olasanmi",
  "davolash ishi qayerlarda bor",
  "PDP narxi qancha",
  "men doktor bolishni orzu qilaman",
  "Toshkentdagi tibbiyot universitetlari",
  "IT haqida batafsil aytib ber",
  "tibbiyot yo'nalishi nima",
  "TATU kontrakti qancha",
];

let ok = true;
for (const msg of cases) {
  const intent = intentClassifier.classify(msg);
  const q = resolveQuery(msg, intent);
  const detailCheck = isDirectionDetailRequest(msg, intent);
  console.log(`[${msg}]`);
  console.log(`  intent=${intent.intent} dir=${intent.entities?.direction || "-"} uni=${intent.entities?.university || "-"}`);
  console.log(`  queryType=${q.type} phrase=${q.directionPhrase || "-"} detail=${detailCheck}`);
}

// direction_detail formatter test (real natija shakli bilan)
console.log("\n=== formatDirectionDetail TEST ===");
const sample = {
  tool: "search_direction",
  success: true,
  data: {
    directions: [
      { nameUz: "Davolash ishi", nameEn: "General Medicine" },
      { nameUz: "Davolash ishi (tibbiyot)", nameEn: "Medicine" },
    ],
    universities: [
      { fullNameUz: "Toshkent tibbiyot akademiyasi", location: "Toshkent shahri" },
      { fullNameUz: "Samarqand davlat tibbiyot universiteti", location: "Samarqand viloyati" },
    ],
    directionDetail: true,
    directionPhrase: "davolash ishi",
  },
};
console.log(formatDirectionDetail(sample, "davolash ishi"));

process.exit(ok ? 0 : 1);
