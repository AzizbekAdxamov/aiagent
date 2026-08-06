/**
 * DEFINITIVE TEST: "tibbiyot yo'nalishi" -> full real pipeline with AI OFF.
 * Shows exactly what chat route saves/sends (after sanitizeText).
 */
process.env.GROQ_API_KEY = "";
process.env.GEMINI_API_KEY = "";
process.env.OPENAI_API_KEY = "";
process.env.JINA_API_KEY = "";

import { providerManager } from "../src/ai-agent/provider-manager";
import { sanitizeText } from "../src/lib/sanitize-text";

async function main() {
  providerManager.init();
  console.log(`[TEST] isInitialized = ${providerManager.isInitialized()}`);

  const res = await providerManager.generateResponse(
    "tibbiyot yo'nalishi",
    { language: "uz" },
    [],
    "uz"
  );

  console.log(`\nINTENT=${res.intent} | TOOL=${res.toolUsed} | PROVIDER=${res.provider}`);
  console.log(`\n=========== RAW CONTENT (formatter output) ===========`);
  console.log(res.content);
  console.log(`\n=========== WHAT CHAT ROUTE SENDS (after sanitizeText) ===========`);
  const sanitized = sanitizeText(res.content || "");
  console.log(sanitized);
  console.log(`\n[DONE] length raw=${(res.content||"").length} sanitized=${sanitized.length}`);
}

main().catch((e) => {
  console.error("TEST FAILED:", e);
  process.exit(1);
});
