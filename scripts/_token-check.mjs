import { readFileSync } from "fs";
const env = readFileSync(".env", "utf8");
const getEnv = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, "m"));
  return m ? m[1].trim() : undefined;
};

const decode = (t) => {
  try {
    const p = JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString());
    return p;
  } catch (e) {
    return null;
  }
};

const now = Math.floor(Date.now() / 1000);
const fmt = (s) => (s ? new Date(s * 1000).toISOString() : "?");
const tokens = [
  ["ACCESS (active, line 21)", getEnv("MENTALABA_API_KEY")],
  ["REFRESH (active, line 22)", getEnv("MENTALABA_REFRESH_TOKEN")],
];
console.log(`Hozirgi vaqt: ${fmt(now)} (epoch ${now})\n`);
for (const [label, t] of tokens) {
  const p = decode(t);
  if (!p) {
    console.log(`${label}: decode qilib bo'lmadi`);
    continue;
  }
  const status = now > p.exp ? "🔴 MUDDATI O'TGAN (expired)" : now > p.iat ? "🟢 AMAL QILADI" : "🟡 hali ishlamaydi";
  console.log(`${label}:`);
  console.log(`  iat: ${fmt(p.iat)}  exp: ${fmt(p.exp)}  → ${status}`);
}
