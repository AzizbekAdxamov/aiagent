/**
 * QUICK TEST: AI providers OFF (no Groq/Gemini/OpenAI calls).
 * Uses only fast queries (university overview, grants, news)
 * to prove the external Mentalaba API data flows via template fallback.
 */
process.env.GROQ_API_KEY = "";
process.env.GEMINI_API_KEY = "";
process.env.OPENAI_API_KEY = "";
process.env.JINA_API_KEY = "";

import { providerManager } from "../src/ai-agent/provider-manager";
import type { ChatMessage } from "../src/types";

async function main() {
  providerManager.init();
  console.log(`[TEST] isInitialized = ${providerManager.isInitialized()} (false = AI OFF)`);

  const messages = [
    "O'zbekistonda nechta universitet bor?",
    "grantlar bormi",
    "so'nggi yangiliklar",
  ];

  const history: ChatMessage[] = [];

  for (const msg of messages) {
    console.log(`\n================ [TEST] "${msg}" ================`);
    const res = await providerManager.generateResponse(msg, { language: "uz" }, history, "uz");
    const firstLine = (res.content || "").split("\n")[0];
    console.log(`INTENT=${res.intent} | TOOL=${res.toolUsed} | PROVIDER=${res.provider}`);
    console.log(`→ ${firstLine}`);
    history.push({ id: `u${history.length}`, role: "user", content: msg, timestamp: new Date() });
    history.push({
      id: `a${history.length}`,
      role: "assistant",
      content: res.content,
      intent: res.intent,
      selectedTool: res.toolUsed,
      timestamp: new Date(),
    });
  }

  console.log("\n[TEST] DONE");
}

main().catch((e) => {
  console.error("TEST FAILED:", e);
  process.exit(1);
});
