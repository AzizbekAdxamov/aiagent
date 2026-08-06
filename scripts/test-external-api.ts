/**
 * TEST: External Mentalaba API status.
 * Checks whether the data API returns real data with the configured token.
 */
import { externalApi } from "../src/lib/external-api";

async function main() {
  console.log(`[API] BASE_URL = ${(externalApi as any).baseURL || "?"}`);

  const tests: Array<[string, () => Promise<any>]> = [
    ["universities/filter", () => externalApi.getUniversitiesFilter({ limit: 3 })],
    ["universities select-box", () => externalApi.getUniversitiesSelectBox()],
    ["news", () => externalApi.getNews({ limit: 3 })],
    ["grants", () => externalApi.getGrants({ limit: 3 })],
    ["directions/bot", () => externalApi.getDirectionsBot({ limit: 3 })],
  ];

  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      const arr = Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : [];
      console.log(`✅ ${name}: ${arr.length} ta element | first: ${JSON.stringify(arr[0])?.substring(0, 120)}`);
    } catch (e: any) {
      console.log(`❌ ${name}: ${e?.message?.substring(0, 200)}`);
    }
  }

  console.log("\n[DONE]");
}

main().catch((e) => {
  console.error("TEST FAILED:", e);
  process.exit(1);
});
