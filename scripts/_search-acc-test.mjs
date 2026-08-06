import { ToolRouter } from '../src/ai-agent/tool-router.ts';

const tr = new ToolRouter();
const tmd = (name, term) => tr.termMatchesDirection(name.toLowerCase(), term);
const generic = (term) => tr.isGenericDirectionTerm(term);

let pass = 0, fail = 0;
const check = (label, cond) => {
  if (cond) { pass++; console.log('  ✅', label); }
  else { fail++; console.log('  ❌', label); }
};

console.log('=== 1. Word-boundary: "it" "Matematika"ga tushmaydi ===');
check('it ∈ matematika → false', !tmd('matematika', 'it'));
check('it ∈ genetika → false', !tmd('genetika', 'it'));
check('it ∈ kiberxavfsizlik → false', !tmd('kiberxavfsizlik', 'it'));
check('it ∈ "IT (axborot texnologiyalari)" → true', tmd('it (axborot texnologiyalari)', 'it'));
check('it ∈ "Axborot texnologiyalari (IT)" → true', tmd('axborot texnologiyalari (it)', 'it'));

console.log('=== 2. Specific vs Generic ===');
check('"axborot texnolog" specific', !generic('axborot texnolog'));
check('"suniy intellekt" specific', !generic('suniy intellekt'));
check('"dasturlash" specific', !generic('dasturlash'));
check('"kiberxavfsizlik" specific', !generic('kiberxavfsizlik'));
check('"information" generic', generic('information'));
check('"injiniring" generic', generic('injiniring'));
check('"texnologiya" generic', generic('texnologiya'));
check('"it" generic', generic('it'));
check('"kompyuter fan" specific', !generic('kompyuter fan'));

console.log('=== 3. TTA false-positive manbai (Health Informatics) ===');
// "information" hali listda, lekin generic — 1 ta moslik yetarli emas
check('Health Informatics ~ information → generic', generic('information'));
// Endi "injiniring" IT listida emas — Biologiya injiniringi IT bo\'lmaydi
const itTerms = tr.expandSearchKeyword('it');
check('"injiniring" IT listida emas', !itTerms.includes('injiniring'));
check('"information" IT listida (generic signal)', itTerms.includes('information'));
check('"kompyuter injiniring" IT listida (specific)', itTerms.includes('kompyuter injiniring'));
check('"dasturiy injiniring" IT listida (specific)', itTerms.includes('dasturiy injiniring'));

console.log('=== 4. Chiroyli IT so\'zlari hali ham match ===');
check('axborot texnolog → "Axborot texnologiyalari"', tmd('axborot texnologiyalari', 'axborot texnolog'));
check('dasturlash → "Dasturlash muhandisligi"', tmd('dasturlash muhandisligi', 'dasturlash'));
check('kiberxavfsizlik → "Kiberxavfsizlik"', tmd('kiberxavfsizlik', 'kiberxavfsizlik'));
check('web (qisqa) → "Web dasturlash"', tmd('web dasturlash', 'web'));
check('ai (qisqa) → "Artificial Intelligence"', tmd('artificial intelligence', 'ai'));

console.log('\n📊 NATIJA:', `${pass} ✅ / ${fail} ❌`);
process.exit(fail > 0 ? 1 : 0);
