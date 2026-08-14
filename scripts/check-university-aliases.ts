/**
 * CANONICAL ALIAS CHECKER (BOSQICH 20 — Entity Resolution tekshiruvi)
 *
 * Live API'dagi universitetlar ro'yxatini olib, `university-aliases.ts` dagi
 * canonical alias jadvalini tekshiradi:
 *
 *   1) ❌ ERROR — alias target slug DB'da YO'Q (jadval eskirgan/noto'g'ri)
 *   2) ❌ ERROR — alias DB abbr bilan mos emas (bir xil qisqartma 2 joyga
 *      ko'rsatgan bo'lsa)
 *   3) ❌ ERROR — DB abbr konflikti: 1 qisqartma → 2+ universitеt
 *      (hozir: AIU → Asia International + Osiyo Xalqaro; IMPULS → 2 filial)
 *   4) ⚠️  WARN — kod regex'laridagi qisqartma na DB'da, na alias jadvalda
 *      (to'ldirilishi kerak: MIS, MESI, TTPI, TATI, TQI, TOSHKEU, TOSHSEI...)
 *   5) ℹ️  INFO — bir universitеtning bir nechta abbr'i (duplicate) va
 *      bir xil nomdagi EN/UZ qatorlar
 *
 * Ishlatish:
 *   npx tsx scripts/check-university-aliases.ts          # live API bilan
 *   npx tsx scripts/check-university-aliases.ts --offline  # stub ro'yxat bilan (CI)
 *
 * Chiqish kodi: 0 = ERROR yo'q, 1 = kamida bitta ERROR (WARN hisobga olinmaydi).
 */
import { UNIVERSITY_ALIASES, KNOWN_CODE_ABBREVIATIONS, resolveAliasedUniversity } from "../src/ai-agent/university-aliases";

const BASE = "https://api.mentalaba.uz/v1";

// ─────────────────────────────────────────────────────────────
// STUB (offline rejim) — CI'da tarmoq bo'lmasa ham tekshiruv ishlaydi
// ─────────────────────────────────────────────────────────────
const STUB_UNIVERSITIES: any[] = [
  { id: 97, slug: "toshkent-axborot-texnologiyalari-universiteti", full_name_uz: "Toshkent axborot texnologiyalari universiteti", abbr_name_uz: "TATU", abbr_name_en: "TUIT" },
  { id: 2, slug: "inha-university-in-tashkent", full_name_uz: "Inha University in Tashkent", abbr_name_uz: "IUT" },
  { id: 123, slug: "toshkent-tibbiyot-akademiyasi", full_name_uz: "Toshkent tibbiyot akademiyasi", abbr_name_uz: "TMA" },
  { id: 167, slug: "xalqaro-tmc-instituti", full_name_uz: "Xalqaro TMC instituti", abbr_name_uz: "TMC" },
  { id: 96, slug: "toshkent-arxitektura-qurilish-universiteti", full_name_uz: "Toshkent arxitektura-qurilish universiteti", abbr_name_uz: "TAQU" },
  { id: 16, slug: "toshkent-amaliy-fanlar-universiteti", full_name_uz: "Toshkent Amaliy Fanlar Universiteti", abbr_name_uz: "UTAS" },
  { id: 150, slug: "pdp-university", full_name_uz: "PDP University", abbr_name_uz: "PDP" },
];

const OFFLINE = process.argv.includes("--offline");

async function fetchUniversities(): Promise<any[]> {
  if (OFFLINE) return STUB_UNIVERSITIES;
  const res = await fetch(`${BASE}/universities/filter?limit=200`, {
    headers: { "User-Agent": "MentalabaBot/1.0" },
  });
  const json = await res.json().catch(() => ({}));
  const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
  return list.filter((u: any) => !/texnikum|kollej|litsey/i.test(String(u.full_name_uz || u.fullNameUz || "")));
}

async function main() {
  let errors = 0;
  let warns = 0;
  let infos = 0;

  const list = await fetchUniversities();
  console.log(`\n🔎 CANONICAL ALIAS CHECKER — ${OFFLINE ? "OFFLINE (stub)" : "LIVE API"} — ${list.length} ta universitеt\n`);

  // Map'lar
  const bySlug = new Map<string, any>();
  const byAbbr = new Map<string, any[]>();
  for (const u of list) {
    const slug = String(u.slug || u.slugUz || "").toLowerCase();
    if (slug) bySlug.set(slug, u);
    const abbrs = [u.abbr_name_uz, u.abbrNameUz, u.abbr_name_en, u.abbrNameEn]
      .filter(Boolean)
      .map((a: any) => String(a).toUpperCase().trim());
    for (const a of new Set(abbrs)) {
      if (!byAbbr.has(a)) byAbbr.set(a, []);
      byAbbr.get(a)!.push(u);
    }
  }

  if (!OFFLINE) {
    // ── 1) Alias jadval tekshiruvi (faqat LIVE — to'liq DB talab qilinadi) ──
    console.log("── ALIAS JADVAL (university-aliases.ts) ──");
    const aliasEntries = Object.entries(UNIVERSITY_ALIASES).sort();
    for (const [abbr, slug] of aliasEntries) {
      const uni = bySlug.get(slug);
      if (!uni) {
        errors++;
        console.log(`  ❌ ${abbr} → slug "${slug}" DB'da TOPILMADI`);
        continue;
      }
      const dbAbbrHit = byAbbr.get(abbr);
      if (dbAbbrHit && dbAbbrHit.length === 1) {
        const dbSlug = String(dbAbbrHit[0].slug || "").toLowerCase();
        if (dbSlug && dbSlug !== slug) {
          errors++;
          console.log(`  ❌ ${abbr} → alias="${slug}" LEKIN DB'da abbr boshqa univga: ${dbSlug}`);
          continue;
        }
      }
      // resolve funksiyasi tasdiqlanadi
      const resolved = resolveAliasedUniversity(abbr, list);
      if (!resolved || String(resolved.slug || "").toLowerCase() !== slug) {
        errors++;
        console.log(`  ❌ ${abbr} → resolveAliasedUniversity natijasi noto'g'ri (${resolved?.slug || "null"})`);
        continue;
      }
      console.log(`  ✅ ${abbr} → ${(uni.full_name_uz || uni.fullNameUz || slug).substring(0, 50)}`);
    }

    // ── 2) DB abbr konfliktlar (1 abbr → 2+ univ) ──
    console.log("\n── DB ABBR KONFLIKTLAR ──");
    let conflictFound = false;
    for (const [a, us] of byAbbr) {
      if (us.length > 1) {
        conflictFound = true;
        errors++;
        console.log(`  ❌ ${a} → ${us.map((u: any) => (u.full_name_uz || u.fullNameUz || "").substring(0, 35)).join(" | ")}`);
      }
    }
    if (!conflictFound) console.log("  ✅ Konflikt yo'q");

    // ── 3) Kod qisqartmalari qamrovi ──
    console.log("\n── KOD QISQARTMALARI QAMROVI ──");
    const unmapped: string[] = [];
    for (const abbr of KNOWN_CODE_ABBREVIATIONS) {
      if (byAbbr.has(abbr) || UNIVERSITY_ALIASES[abbr]) continue;
      unmapped.push(abbr);
    }
    if (unmapped.length > 0) {
      warns += unmapped.length;
      console.log(`  ⚠️  Na DB'da, na alias jadvalda: ${unmapped.join(", ")}`);
      console.log(`     (to'ldirish: src/ai-agent/university-aliases.ts → UNIVERSITY_ALIASES)`);
    } else {
      console.log("  ✅ Barcha kod qisqartmalari qoplangan");
    }

    // ── 4) Duplicate abbr (bir univ, bir nechta abbr) — INFO ──
    console.log("\n── DUPLICATE ABBR (ma'lumot) ──");
    let dupInfo = 0;
    const uniAbbrs = new Map<number, string[]>();
    for (const [a, us] of byAbbr) {
      for (const u of us) {
        if (!uniAbbrs.has(u.id)) uniAbbrs.set(u.id, []);
        uniAbbrs.get(u.id)!.push(a);
      }
    }
    for (const [id, abbrs] of uniAbbrs) {
      if (abbrs.length > 1) {
        dupInfo++;
        infos++;
        const u = list.find((x: any) => x.id === id);
        console.log(`  ℹ️  id=${id} (${(u?.full_name_uz || u?.fullNameUz || "").substring(0, 35)}) abbr'lari: ${abbrs.join(", ")}`);
      }
    }
    if (dupInfo === 0) console.log("  ℹ️  Duplicate yo'q");
  } else {
    console.log("OFFLINE rejim — faqat resolution testlar (DB tekshiruvi LIVE rejimda ishlaydi)");
  }

  // ── 5) Alias resolution unit-testlar (offline stub bilan ham ishlaydi) ──
  console.log("\n── ALIAS RESOLUTION TESTS ──");
  const cases: Array<[string, string]> = [
    ["TUIT", "toshkent-axborot-texnologiyalari-universiteti"],
    ["INHA", "inha-university-in-tashkent"],
    ["TTA", "toshkent-tibbiyot-akademiyasi"],
    ["TMCI", "xalqaro-tmc-instituti"],
    ["TAQI", "toshkent-arxitektura-qurilish-universiteti"],
    ["TASI", "toshkent-arxitektura-qurilish-universiteti"],
    ["TAFU", "toshkent-amaliy-fanlar-universiteti"],
  ];
  for (const [abbr, expectedSlug] of cases) {
    const r = resolveAliasedUniversity(abbr, list);
    const ok = !!r && String(r.slug || r.slugUz || "").toLowerCase() === expectedSlug;
    if (!ok) errors++;
    console.log(`  ${ok ? "✅" : "❌"} ${abbr} → ${expectedSlug}${r ? ` | ${(r.full_name_uz || r.fullNameUz || "").substring(0, 35)}` : ""}`);
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`NATIJA: ${errors} xato, ${warns} ogohlantirish, ${infos} ma'lumot`);
  console.log(`========================================`);
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("[Checker Error]", e?.message || e);
  process.exit(1);
});
