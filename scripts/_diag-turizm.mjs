// TURIZM DIAGNOSTIKA: qaysi univlarda turizm yo'nalishlari bor + texnikumlar ro'yxati
import { readFileSync } from "fs";

const env = readFileSync(".env", "utf8");
const getEnv = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, "m"));
  return m ? m[1].trim() : undefined;
};
const BASE = getEnv("MENTALABA_API_URL") || "https://api.mentalaba.uz/v1";
const REFRESH = getEnv("MENTALABA_REFRESH_TOKEN");
let TOKEN = getEnv("MENTALABA_API_KEY");
if (REFRESH) {
  try {
    const r = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: REFRESH }),
    });
    if (r.ok) {
      const d = await r.json();
      TOKEN = d.accessToken || d.access_token || d.token || TOKEN;
    }
  } catch {}
}
const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

const TURIZM_TERMS = ["turizm", "mehmondo'stlik", "hotel", "restoran", "mehmonxona", "sayohat", "xizmat kursatish", "ovqatlanish", "hospitality"];

function termMatches(name, term) {
  const t = term.toLowerCase();
  if (!t) return false;
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    return new RegExp(`(^|[^a-z0-9'’])${esc}`, "i").test(name);
  } catch {
    return name.includes(t);
  }
}

async function fetchUnis() {
  const res = await fetch(`${BASE}/universities/filter?limit=500`, { headers });
  const j = await res.json();
  const data = Array.isArray(j) ? j : j.data || j.universities || [];
  return Array.isArray(data) ? data : data.universities || data.items || [];
}

async function main() {
  const unis = await fetchUnis();
  console.log(`JAMI UNIVERSITETLAR: ${unis.length}`);

  // Texnikumlar ro'yxati
  const texnikums = unis.filter((u) => /texnikum|kollej|litsey/i.test(`${u.full_name_uz || ''} ${u.full_name_en || ''}`));
  console.log(`\nTEXNIKUM/KOLLEJ/LITSEY nomli muassasalar (${texnikums.length} ta):`);
  texnikums.slice(0, 30).forEach((u) => console.log(`  #${u.id} ${(u.full_name_uz || '').substring(0, 60)}`));

  // Har bir univ uchun turizm yo'nalishlarini tekshirish
  const rows = [];
  const CONC = 6;
  let idx = 0;
  async function worker() {
    while (idx < unis.length) {
      const i = idx++;
      const u = unis[i];
      const uid = u.id ?? u.university_id;
      const name = u.full_name_uz || u.fullNameUz || u.full_name_en || u.fullNameEn || `#${uid}`;
      let dirs = [];
      try {
        const res = await fetch(`${BASE}/directions/getAll/${uid}`, { headers });
        if (res.ok) {
          const j = await res.json();
          dirs = Array.isArray(j) ? j : j.data || j.directions || [];
        }
      } catch {}
      const strongNames = new Set();
      for (const d of dirs) {
        const nz = (d.name_uz || d.name || "").toLowerCase();
        const ne = (d.name_en || "").toLowerCase();
        for (const t of TURIZM_TERMS) {
          if (termMatches(nz, t) || termMatches(ne, t)) {
            const key = (nz || ne).replace(/\s+/g, " ").trim();
            if (key) strongNames.add(key);
            break;
          }
        }
      }
      const strongCount = strongNames.size;
      const totalDirs = dirs.length;
      if (strongCount >= 1) {
        const share = strongCount / Math.max(totalDirs, 1);
        const isTexnikum = /texnikum|kollej|litsey/i.test(`${u.full_name_uz || ''} ${u.full_name_en || ''}`);
        rows.push({ uid, name, strongCount, totalDirs, share, isTexnikum });
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));

  rows.sort((a, b) => b.share - a.share);
  console.log(`\n========== TURIZM (turizm yo'nalishi bor univlar) ==========`);
  console.log(`Jami: ${rows.length} ta`);
  rows.slice(0, 30).forEach((r, i) => {
    const tag = r.isTexnikum ? " [TEXNIKUM]" : "";
    console.log(`  ${String(i + 1).padStart(2)}. #${r.uid} ${r.name.substring(0, 48).padEnd(48)} strong=${String(r.strongCount).padStart(3)} jami=${String(r.totalDirs).padStart(4)} ulush=${String(Math.round(r.share * 100)).padStart(3)}%${tag}`);
  });
}

main().catch((e) => {
  console.log("XATO:", e.message);
  process.exit(1);
});
