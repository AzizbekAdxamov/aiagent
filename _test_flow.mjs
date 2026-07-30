// Mentalaba AI — Comprehensive Test Suite
// Tests ALL endpoints in a SINGLE session
import fetch from 'node-fetch';

const BASE = 'http://localhost:3000/api/v1/chat';
let sessionId = null;
let stepNum = 0;
let passed = 0;
let failed = 0;

async function ask(question, expectedIntent) {
  stepNum++;
  const body = { message: question, language: 'uz' };
  if (sessionId) body.sessionId = sessionId;

  try {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    
    if (!sessionId && json.data?.sessionId) {
      sessionId = json.data.sessionId;
    }

    const content = json.data?.message || '';
    const intent = json.data?.intent || 'unknown';
    const tool = json.data?.toolUsed || 'none';
    const firstLine = content.split('\n')[0].trim().substring(0, 100);

    let status = '✅';
    let issues = [];

    // Check: no fallback/error message
    if (content.includes('Kechirasiz') && !content.includes('topilmadi')) {
      // "Kechirasiz, topa olmadim" is fallback — bad unless expected
      if (!expectedIntent?.allowFallback) {
        status = '❌';
        issues.push('FALLBACK');
      }
    }

    // Check: not empty
    if (!content || content.length < 10) {
      status = '❌';
      issues.push('EMPTY');
    }

    // Check: intent matches expected
    if (expectedIntent?.intent && intent !== expectedIntent.intent) {
      issues.push(`INTENT:${intent}≠${expectedIntent.intent}`);
    }

    // Check: tool was used (for data intents)
    if (expectedIntent?.expectTool && (!tool || tool === 'none')) {
      issues.push('NO_TOOL');
    }

    if (issues.length > 0) {
      status = '❌';
      failed++;
    } else {
      passed++;
    }

    const intentLabel = expectedIntent?.intent || intent;
    console.log(`${status} Step ${stepNum}: ${question.substring(0, 60).padEnd(62)} [${intentLabel}] ${tool ? `🔧${tool.substring(0,20)}` : ''}`);
    console.log(`   ↳ ${firstLine}...`);
    if (issues.length > 0) {
      console.log(`   ⚠️  ${issues.join(', ')}`);
    }
    console.log();

    return { content, intent, tool, status };
  } catch (err) {
    failed++;
    console.log(`❌ Step ${stepNum}: ${question.substring(0, 60).padEnd(62)} [ERROR]`);
    console.log(`   ↳ ${err.message}`);
    console.log();
    return { content: '', intent: 'error', tool: 'none', status: '❌' };
  }
}

async function runTests() {
  console.log('='.repeat(80));
  console.log('🔥 MENTALABA AI — KOMPREHENSIV TEST 🔥');
  console.log('='.repeat(80));
  console.log();

  // =============================================
  // TEST 1: GREETING
  // =============================================
  console.log('─── 1. GREETING ───');
  await ask('salom', { intent: 'greeting' });

  // =============================================
  // TEST 2: OVERVIEW — nechta universitet?
  // =============================================
  console.log('─── 2. OVERVIEW ───');
  const overview = await ask("O'zbekistonda nechta universitet bor?", { intent: 'university_search', expectTool: true });
  
  // Check overview contains correct numbers (152 total, 3 categories)
  const has152 = overview.content.includes('152') || overview.content.includes('totalCount');
  const hasCategories = overview.content.includes('Davlat') && overview.content.includes('Xususiy') && overview.content.includes('Xalqaro');
  if (!has152) console.log(`   ⚠️  Muammo: 152 ta universitet soni topilmadi`);
  if (!hasCategories) console.log(`   ⚠️  Muammo: Kategoriyalar davlat/xususiy/xalqaro topilmadi`);
  if (has152 && hasCategories) { passed++; } else { failed++; }

  // =============================================
  // TEST 3: REGION + CATEGORY — Toshkentdagi xalqaro
  // =============================================
  console.log('─── 3. REGION + CATEGORY ───');
  const regionCat = await ask('menga toshkentdagi xalqaro universitetlar kerak', { intent: 'university_search', expectTool: true });
  
  // Check: shows region, not overview
  const isRegionFormat = regionCat.content.includes('Toshkent') && regionCat.content.includes('xalqaro');
  const hasList = regionCat.content.includes('1.') || regionCat.content.includes('Amity');
  if (!isRegionFormat) console.log(`   ⚠️  Muammo: Toshkent/xalqaro region formatida javob kelmadi`);
  if (!hasList) console.log(`   ⚠️  Muammo: Universitetlar ro'yxati yo'q`);

  // =============================================
  // TEST 4: SPECIFIC UNIVERSITY — Turin Politexnika
  // =============================================
  console.log('─── 4. SPECIFIC UNIVERSITY ───');
  const specific = await ask('Turin Politexnika universiteti haqida ma\'lumot ber', { intent: 'university_search', expectTool: true });
  
  // CRITICAL: Must show SINGLE university, NOT overview!
  const isSingleUni = specific.content.includes('## 🏛') || specific.content.includes('Turin');
  const isOverview = specific.content.includes('O\'zbekistondagi') && specific.content.includes('152 ta');
  if (!isSingleUni) console.log(`   ⚠️  Muammo: Single university formatida javob kelmadi`);
  if (isOverview) console.log(`   ⚠️  XATO: Overview formati keldi (152 ta), single uni bo'lishi kerak edi!`);
  
  // Check: has details
  const hasDetails = specific.content.includes('Grant') || specific.content.includes('To\'lov') || specific.content.includes('Manzil') || specific.content.includes('Turi');
  if (!hasDetails) console.log(`   ⚠️  Muammo: Batafsil ma'lumotlar (Grant/To'lov/Manzil) yo'q`);

  // =============================================
  // TEST 5: FOLLOW-UP DIRECTIONS — nechta yo'nalishi bor?
  // =============================================
  console.log('─── 5. FOLLOW-UP DIRECTIONS ───');
  const dirFollowUp = await ask('nechta yo\'nalishi bor?', { intent: 'direction_search', expectTool: true });
  
  const hasDirectionData = dirFollowUp.content.includes('yo\'nalish') || dirFollowUp.content.includes('ta');
  if (!hasDirectionData) console.log(`   ⚠️  Muammo: Yo'nalish ma'lumoti kelmadi`);

  // =============================================
  // TEST 6: GRANT — grant bormi?
  // =============================================
  console.log('─── 6. GRANT ───');
  const grantFollowUp = await ask('grant bormi?', { intent: 'grant_search', expectTool: true });
  
  const hasGrantInfo = grantFollowUp.content.includes('grant') || grantFollowUp.content.includes('Grant');
  if (!hasGrantInfo) console.log(`   ⚠️  Muammo: Grant ma'lumoti kelmadi`);

  // =============================================
  // TEST 7: ANOTHER UNIVERSITY — Amity
  // =============================================
  console.log('─── 7. ANOTHER UNIVERSITY ───');
  const amity = await ask('Amity Universiteti haqida ma\'lumot ber', { intent: 'university_search', expectTool: true });
  
  const isAmitySingle = amity.content.includes('Amity');
  const amityHasDetails = amity.content.includes('Grant') || amity.content.includes('To\'lov');
  if (!isAmitySingle) console.log(`   ⚠️  Muammo: Amity topilmadi`);
  if (!amityHasDetails) console.log(`   ⚠️  Muammo: Amity da batafsil ma'lumot yo'q`);

  // =============================================
  // TEST 8: TUITION — narxi qancha?
  // =============================================
  console.log('─── 8. TUITION (follow-up) ───');
  const tuition = await ask('narxi qancha?', { intent: 'university_search', expectTool: true });
  
  // Should show Amity details or tuition info
  const hasTuition = tuition.content.includes('so\'m') || tuition.content.includes('mln') || tuition.content.includes('To\'lov');
  if (!hasTuition) console.log(`   ⚠️  Muammo: Narx ma'lumoti topilmadi`);

  // =============================================
  // TEST 9: DIRECTIONS (IT sohasi)
  // =============================================
  console.log('─── 9. DIRECTIONS (IT) ───');
  const itDirections = await ask('IT ga qiziqaman, qanday yo\'nalishlar bor?', { intent: 'direction_search', expectTool: true });
  
  const hasIT = itDirections.content.includes('IT') || itDirections.content.includes('Dasturlash') || itDirections.content.includes('Kompyuter');
  if (!hasIT) console.log(`   ⚠️  Muammo: IT yo'nalishlari topilmadi`);

  // =============================================
  // TEST 10: NEWS
  // =============================================
  console.log('─── 10. NEWS ───');
  const news = await ask('so\'nggi yangiliklar', { intent: 'news_search', expectTool: true });
  
  const hasNews = news.content.includes('Yangilik') || news.content.includes('yangilik');
  if (!hasNews) console.log(`   ⚠️  Muammo: Yangiliklar topilmadi`);

  // =============================================
  // SUMMARY
  // =============================================
  console.log('='.repeat(80));
  console.log(`📊 TEST NATIJALARI`);
  console.log('='.repeat(80));
  console.log(`✅ O'tgan: ${passed}`);
  console.log(`❌ Yiqilgan: ${failed}`);
  console.log(`📝 Jami testlar: ${passed + failed}`);
  console.log(`📋 Session ID: ${sessionId}`);
  console.log('='.repeat(80));
  
  if (failed > 0) {
    console.log(`\n⚠️  ${failed} ta test yiqildi. Yuqoridagi ❌ belgilarini tekshiring.`);
  } else {
    console.log(`\n🎉 BARCHA TESTLAR O'TD! Agent to'g'ri ishlayapti!`);
  }
}

runTests().catch(console.error);
