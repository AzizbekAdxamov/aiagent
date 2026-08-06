/**
 * TEST / BENCHMARK: LLM-assisted entity extraction (BOSQICH 5).
 *
 * Rule-based (intentClassifier.extractEntities) vs LLM (extractEntitiesWithLLM)
 * natijalarini solishtiradi.
 *
 * ISHLATISH:
 *   - API key YO'Q bo'lsa: faqat rule-based natija ko'rsatiladi (LLM o'tkazib yuboriladi)
 *   - API key BOR bo'lsa: LLM natijasi ham olinadi va solishtiriladi
 *
 *   npx tsx scripts/test-llm-entities.ts
 */
import { intentClassifier } from "../src/ai-agent/intent-classifier";
import { providerManager } from "../src/ai-agent/provider-manager";

interface BenchmarkCase {
  msg: string;
  expect: Record<string, any>;
}

const cases: BenchmarkCase[] = [
  {
    msg: "Toshkentdagi xususiy tibbiyot universitetlari, 20 mln gacha",
    expect: { region: "14", institutionCategory: "4", direction: "tibbiyot", tuitionMax: 20000000 },
  },
  {
    msg: "Samarqanddagi davlat IT universitetlari",
    expect: { region: "8", institutionCategory: "3", direction: "it" },
  },
  {
    msg: "Toshkent shahrida ingliz tilidagi xususiy bakalavr universitetlar",
    expect: { region: "14", language: "english", institutionCategory: "4", degree: "bachelor" },
  },
  {
    msg: "kontrakti 15 dan 30 mln gacha bo'lganlar",
    expect: { tuitionMin: 15000000, tuitionMax: 30000000 },
  },
  {
    msg: "stomatologiya fakulteti bor, yotoqxonali, grantli universitetlar",
    expect: { faculty: "stomatologiya", accommodation: "true" },
  },
  {
    msg: "Amity universiteti haqida batafsil ma'lumot",
    expect: { university: "amity" },
  },
  {
    msg: "Buxorodagi kunduzgi, rus tilidagi davlat universitetlar",
    expect: { region: "3", educationType: "full-time", language: "russian", institutionCategory: "3" },
  },
];

/** Partial match: expect string "amity" → actual "Amity Universiteti" ichida bor */
function checkField(actual: any, expectVal: any): boolean {
  if (expectVal === undefined || expectVal === null) return true;
  if (typeof expectVal === "string" && typeof actual === "string") {
    return actual.toLowerCase().includes(expectVal.toLowerCase());
  }
  return String(actual) === String(expectVal);
}

async function main() {
  providerManager.init();
  const llmAvailable = providerManager.isInitialized();
  console.log(
    `[TEST] Provider: ${llmAvailable ? providerManager.getActiveProvider() : "YO'Q (faqat rule-based)"}\n`
  );

  let rulePass = 0;
  let llmPass = 0;
  const totalFields = cases.reduce((sum, c) => sum + Object.keys(c.expect).length, 0);
  let llmTotal = 0;

  for (const c of cases) {
    const ruleBased = intentClassifier.classify(c.msg).entities;
    let llmEntities: any = null;
    if (llmAvailable) {
      try {
        llmEntities = await providerManager.extractEntitiesWithLLM(c.msg, "uz");
      } catch (e: any) {
        console.log(`   llm: xato → ${e?.message || e}`);
      }
    }

    const ruleOk = Object.keys(c.expect).every((k) => checkField((ruleBased as any)[k], c.expect[k]));
    const llmOk = llmEntities ? Object.keys(c.expect).every((k) => checkField(llmEntities[k], c.expect[k])) : false;
    if (ruleOk) rulePass++;
    if (llmOk) llmPass++;
    if (llmEntities && Object.keys(llmEntities).length > 0) llmTotal++;

    console.log(`📌 "${c.msg}"`);
    console.log(`   expected: ${JSON.stringify(c.expect)}`);
    console.log(`   rule:     ${JSON.stringify(ruleBased)} ${ruleOk ? "✅" : "❌"}`);
    if (llmAvailable) {
      console.log(`   llm:      ${JSON.stringify(llmEntities)} ${llmOk ? "✅" : "❌"}`);
    } else {
      console.log(`   llm:      (o'tkazib yuborildi — provider yo'q)`);
    }
  }

  console.log(`\n📊 RULE: ${rulePass}/${cases.length} case'da barcha expected field'lar topildi`);
  if (llmAvailable) {
    console.log(`📊 LLM:  ${llmPass}/${cases.length} case'da barcha expected field'lar topildi (${llmTotal}/${cases.length} case'da entity qaytardi)`);
    if (rulePass === cases.length && llmPass === cases.length) {
      console.log("✅ Rule-based va LLM ikkalasi ham to'liq mos — benchmark o'tdi!");
    } else if (llmPass > rulePass) {
      console.log("ℹ️  LLM rule-based'dan YAXSHIROQ ishladi (qo'shimcha entity'lar topdi).");
    } else {
      console.log("ℹ️  LLM ba'zi hollarda rule-based'dan past — prompt'ni yaxshilash mumkin.");
    }
  } else {
    console.log("📊 LLM:  o'tkazib yuborildi — .env da API key bo'lganda ishga tushadi (Groq/Gemini/OpenAI).");
    console.log(`ℹ️  Expected field'lar umumiy soni: ${totalFields}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("TEST FAILED:", e);
  process.exit(1);
});
