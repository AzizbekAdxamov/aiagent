/**
 * RESULT VALIDATOR TEST (BOSQICH 14) — API'siz, mock ma'lumot bilan.
 * ISHLATISH: cd backend && npx tsx scripts/test-validator.ts
 */

// MAJOR_DENSITY_RULES qoidasini qayta ishlab chiqamiz (tool-router'dagi bilan bir xil)
const MAJOR_DENSITY_RULES: Record<string, { minStrong: number; minShare: number; orShare: number }> = {
  it: { minStrong: 3, minShare: 0.06, orShare: 0.25 },
  tibbiyot: { minStrong: 5, minShare: 0.12, orShare: 0.40 },
  biomedical: { minStrong: 3, minShare: 0.10, orShare: 0.30 },
  iqtisod: { minStrong: 5, minShare: 0.15, orShare: 0.40 },
  huquq: { minStrong: 3, minShare: 0.10, orShare: 0.30 },
  pedagogika: { minStrong: 5, minShare: 0.15, orShare: 0.30 },
  muhandislik: { minStrong: 6, minShare: 0.20, orShare: 0.40 },
};

function validate(
  candidateIds: number[],
  matches: any[],
  directionCategory: string,
  totalDirsByUni?: Map<number, number>
): { ids: number[]; total: number } {
  if (!directionCategory || candidateIds.length === 0) {
    return { ids: candidateIds, total: candidateIds.length };
  }

  const strongByUni = new Map<number, number>();
  const seen = new Set<string>();
  for (const m of matches as any[]) {
    if (!candidateIds.includes(m.universityId)) continue;
    if (m.matchStrong) {
      const key = `${m.universityId}:${(m.nameUz || m.nameEn || "").toLowerCase().replace(/\s+/g, " ").trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        strongByUni.set(m.universityId, (strongByUni.get(m.universityId) || 0) + 1);
      }
    }
  }

  const rule = MAJOR_DENSITY_RULES[directionCategory] || MAJOR_DENSITY_RULES.it;
  const passing: number[] = [];
  const relaxed: number[] = [];
  for (const id of candidateIds) {
    const strongCount = strongByUni.get(id) || 0;
    if (strongCount < 1) {
      console.log(`  Univ #${id}: chiqarildi (0 ta aniq yo'nalish)`);
      continue;
    }
    const total = totalDirsByUni?.get(id) || strongCount;
    const share = strongCount / Math.max(total, 1);
    const passesMajor = (strongCount >= rule.minStrong && share >= rule.minShare) || share >= rule.orShare;
    console.log(`  Univ #${id}: ${strongCount}/${total} aniq, ulush ${Math.round(share * 100)}% → ${passesMajor ? "O'TDI" : "chiqarildi"}`);
    if (passesMajor) passing.push(id);
    else if (strongCount >= rule.minStrong) relaxed.push(id);
  }

  if (passing.length === 0 && relaxed.length > 0) {
    console.log(`  Fallback: minShare yumshatildi → ${relaxed.length} ta`);
    return { ids: relaxed, total: relaxed.length };
  }
  return { ids: passing, total: passing.length };
}

// ===== SENARIY 1: TTA (sof tibbiyot) + biologiya/kimyo univ + IT univ =====
console.log("=== SENARIY 1: 'doktor bo'lishni orzu qilaman' (tibbiyot) ===");
const matches1 = [
  // Univ #1 (TTA): 6 ta sof tibbiyot yo'nalishi
  { universityId: 1, nameUz: "Davolash ishi", matchStrong: true },
  { universityId: 1, nameUz: "Pediatriya", matchStrong: true },
  { universityId: 1, nameUz: "Jarrohlik", matchStrong: true },
  { universityId: 1, nameUz: "Ginekologiya", matchStrong: true },
  { universityId: 1, nameUz: "Kardiologiya", matchStrong: true },
  { universityId: 1, nameUz: "Stomatologiya", matchStrong: true },
  // Univ #2: faqat 2 ta yondosh (biologiya, kimyo) — chiqishi kerak
  { universityId: 2, nameUz: "Biologiya", matchStrong: true },
  { universityId: 2, nameUz: "Kimyo", matchStrong: true },
  // Univ #3 (TATU): IT — umuman mos emas, chiqishi kerak
  { universityId: 3, nameUz: "Kompyuter injiniringi", matchStrong: false },
];
const totals1 = new Map<number, number>([[1, 30], [2, 60], [3, 40]]); // TTA 30, biologiya univ 60, TATU 40
const r1 = validate([1, 2, 3], matches1, "tibbiyot", totals1);
console.log(`  NATIJA: ids=${JSON.stringify(r1.ids)} (kutilgan: [1] — faqat TTA)`);
console.log(`  ${r1.ids.length === 1 && r1.ids[0] === 1 ? "✅ TO'G'RI" : "❌ XATO"}\n`);

// ===== SENARIY 2: ZARMED (xalqaro tibbiyot, 8 ta) — orShare orqali o'tishi kerak =====
console.log("=== SENARIY 2: ZARMED (8 ta tibbiyot / 50 ta jami) ===");
const matches2: any[] = [];
for (let i = 0; i < 8; i++) {
  matches2.push({ universityId: 10, nameUz: `Tibbiyot yo'nalishi ${i}`, matchStrong: true });
}
for (let i = 0; i < 42; i++) {
  matches2.push({ universityId: 10, nameUz: `Boshqa yo'nalish ${i}`, matchStrong: false });
}
const totals2 = new Map<number, number>([[10, 50]]);
const r2 = validate([10], matches2, "tibbiyot", totals2);
console.log(`  NATIJA: ids=${JSON.stringify(r2.ids)} (ulush 16% — orShare 40% dan past, minStrong 5 yetdi, minShare 12% → O'TISHI kerak)`);
console.log(`  ${r2.ids.includes(10) ? "✅ TO'G'RI (minShare 12% ga yetdi)" : "❌ XATO"}\n`);

// ===== SENARIY 3: TATU IT so'rovida =====
console.log("=== SENARIY 3: TATU (IT) 'it' kategoriyada ===");
const matches3 = [
  { universityId: 20, nameUz: "Kompyuter injiniringi", matchStrong: true },
  { universityId: 20, nameUz: "Sun'iy intellekt", matchStrong: true },
  { universityId: 20, nameUz: "Dasturiy injiniring", matchStrong: true },
  { universityId: 20, nameUz: "Kiberxavfsizlik", matchStrong: true },
  { universityId: 21, nameUz: "Dasturlash", matchStrong: true }, // 1 ta — chiqishi kerak
];
const totals3 = new Map<number, number>([[20, 40], [21, 40]]);
const r3 = validate([20, 21], matches3, "it", totals3);
console.log(`  NATIJA: ids=${JSON.stringify(r3.ids)} (kutilgan: [20] — TATU)`);
console.log(`  ${r3.ids.length === 1 && r3.ids[0] === 20 ? "✅ TO'G'RI" : "❌ XATO"}\n`);

const allOk = r1.ids.length === 1 && r1.ids[0] === 1 && r2.ids.includes(10) && r3.ids.length === 1 && r3.ids[0] === 20;
console.log(allOk ? "=== HAMMASI O'TDI ✅ ===" : "=== XATOLAR BOR ❌ ===");
process.exit(allOk ? 0 : 1);
