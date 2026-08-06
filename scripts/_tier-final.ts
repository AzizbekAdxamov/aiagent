import { ToolRouter } from '../src/ai-agent/tool-router';
const r: any = new ToolRouter();
const tests: Array<[string, string[], number]> = [
  ['it', ['Data Science', "Sun'iy intellekt"], 1],
  ['it', ['Information Systems'], 2],
  ['it', ['Telekommunikatsiya va aloqa'], 3],
  ['it', ['Atrof-muhit muhandisligi', 'Ekologiya'], 4],
  ['it', ['Malumotlar bazasi'], 3],  // generic 'malumotlar' -> weak (tier3)
  ['it', ['Kompyuter injiniringi'], 1],
  ['it', [], 4],
  ['tibbiyot', ['Davolash ishi'], 1],
  ['tibbiyot', ['Biologiya'], 2],
];
let ok = 0;
for (const [cat, names, expectTier] of tests) {
  const res = r.computeDirectionRelevance(cat, names);
  const pass = res.tier === expectTier;
  if (pass) ok++;
  console.log(`${pass ? 'OK' : 'FAIL'} ${cat} ${JSON.stringify(names)} -> tier=${res.tier} rel=${res.relevance}`);
}
console.log(`TIER_NATIJA: ${ok}/${tests.length}`);
