/**
 * REPRO: "tibbiyot" direction search bug.
 * Runs the exact conversation flow in-process to capture DEBUG logs.
 */
import { providerManager } from "../src/ai-agent/provider-manager";
import { intentClassifier } from "../src/ai-agent/intent-classifier";
import type { ChatMessage } from "../src/types";

async function main() {
  providerManager.init();

  let sessionContext: any = { language: "uz" };
  const history: ChatMessage[] = [];

  const messages = [
    "salom",
    "menga toshkent shaxridan universitelar kerak",
    "men ko'proq tibbiyotga qiziqaman shunga mos universitet kerak",
    "tibbiyot",
  ];

  for (const msg of messages) {
    console.log(`\n\n################ [REPRO] USER: "${msg}" ################`);
    const res = await providerManager.generateResponse(msg, sessionContext, history, "uz");
    console.log(`\n[REPRO] INTENT=${res.intent} TOOL=${res.toolUsed} PROVIDER=${res.provider}`);
    console.log(`[REPRO] RESPONSE:\n${res.content}\n`);

    // === Mimic chat route.ts metadata updates ===
    const messageIntent = intentClassifier.classify(msg);
    const entities = messageIntent.entities || {};
    const metadata: Record<string, any> = { ...sessionContext };
    if (entities.region) metadata.currentRegion = entities.region;
    if (entities.institutionCategory) metadata.currentInstitutionCategory = entities.institutionCategory;
    if (entities.direction) metadata.currentDirectionCategory = entities.direction;

    const content = res.content || "";
    const cleanHeading = (value?: string) =>
      value
        ?.replace(/^[^\p{L}\p{N}'"`]+/u, "")
        .replace(/\s+(haqida|yo'nalishlari|universitetlari|ro'yxati)\s*$/i, "")
        .trim();
    const singleUniMatch = content.match(/^#{1,3}\s*(?:🏛\s*)?(.+?)(?:\n|$)/m);
    const dirMatch = content.match(/^#{1,3}\s*(?:📚\s*)?(.+?)\s+yo'nalishlari(?:\n|$)/im);
    const regionMatch = content.match(/^#{1,3}\s*(?:🏛\s*)?(.+?)\s+universitetlari(?:\n|$)/im);
    const extractedTopicName =
      cleanHeading(dirMatch?.[1]) || cleanHeading(regionMatch?.[1]) || cleanHeading(singleUniMatch?.[1]);
    if (extractedTopicName && extractedTopicName.length > 3) metadata.currentTopicName = extractedTopicName;
    sessionContext = metadata;
    console.log(`[REPRO] sessionContext after: ${JSON.stringify(sessionContext)}`);

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
}

main().catch((e) => {
  console.error("REPRO FAILED:", e);
  process.exit(1);
});
