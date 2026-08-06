import { ToolRouter } from '../src/ai-agent/tool-router';
const r: any = new ToolRouter();
const tests: Array<[string, string[], number]> = [
  ['it', ['Data Science', "Sun'iy intellekt"], 1],
  ['it', ['Information Systems'], 2],
  ['it', ['Telekommunikatsiya'], 3],
  ['it', ['Atrof-muhit muhandisligi', 'Ekologiya'], 4],
  ['tibbiyot', ['Davolash ishi'], 1],
  ['tibbiyot', ['Biologiya'], 2],
  ['iqtisod', ['Bank ishi'], 1],
  ['tarix', ['Jahon tarixi'], 1],
  ['it', [], 4],
];
let ok = 0;
for (const [cat, names, expectTier] of tests) {
  const res = r.computeDirectionRelevance(cat, names);
  const pass = res.tier === expectTier;
  if (pass) ok++;
  console.log(`${pass ? 'OK' : 'FAIL'} ${cat} -> tier=${res.tier} rel=${res.relevance}`);
}
console.log(`TIER_NATIJA: ${ok}/${tests.length}`);
