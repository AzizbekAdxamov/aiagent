#!/usr/bin/env node
/**
 * Mentalaba API uchun yangi tokenlar olish va .env faylini yangilash.
 *
 * ISHLATISH:
 *   node scripts/mentalaba-login.mjs                     # email/password so'raydi
 *   node scripts/mentalaba-login.mjs email@site.uz       # password so'raydi
 *   EMAIL=x@y.uz PASSWORD=... node scripts/mentalaba-login.mjs  # env orqali
 *
 * Bu skript:
 *   1. POST /v1/auth/admin/login → { email, password }
 *   2. Yangi accessToken + refreshToken ni oladi
 *   3. .env dagi MENTALABA_API_KEY / MENTALABA_REFRESH_TOKEN ni almashtiradi
 *   4. Yangi token bilan API'ni tekshiradi (GET /v1/universities?limit=1)
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, ".env");
const DEFAULT_URL = "https://api.mentalaba.uz/v1";

function loadEnv() {
  try {
    return readFileSync(ENV_PATH, "utf8");
  } catch {
    return "";
  }
}

function getEnvValue(envText, key) {
  const m = envText.match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].trim() : undefined;
}

function setEnvValue(envText, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(envText)) return envText.replace(re, line);
  return envText.replace(/\n*$/, "") + `\n${line}\n`;
}

function prompt(question, hidden = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    if (hidden) {
      // password kiritishni yashirish (stdin raw mode)
      process.stdin.on("data", (char) => {
        char = char + "";
        switch (char) {
          case "\n":
          case "\r":
          case "\u0004":
            process.stdin.removeAllListeners("data");
            process.stdout.write("\n");
            resolve(answer);
            break;
          default:
            answer += char.replace(/[\x00-\x1f]/g, "");
            process.stdout.write("*");
        }
      });
      let answer = "";
      rl.close();
    } else {
      rl.question(question, (a) => {
        rl.close();
        resolve(a.trim());
      });
    }
  });
}

function decodeJwt(token) {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  } catch {
    return null;
  }
}

async function main() {
  const envText = loadEnv();
  const apiUrl = getEnvValue(envText, "MENTALABA_API_URL") || DEFAULT_URL;

  const email =
    process.argv[2] || process.env.EMAIL || process.env.MENTALABA_ADMIN_EMAIL;
  const password = process.env.PASSWORD || process.env.MENTALABA_ADMIN_PASSWORD;

  const finalEmail = email || (await prompt("Admin email: "));
  const finalPassword = password || (await prompt("Admin parol: ", true));

  if (!finalEmail || !finalPassword) {
    console.error("❌ Email va parol kerak.");
    process.exit(1);
  }

  console.log(`\n🔐 ${apiUrl}/auth/admin/login ga kirish...`);
  let res;
  try {
    res = await fetch(`${apiUrl}/auth/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: finalEmail, password: finalPassword }),
    });
  } catch (e) {
    console.error(`❌ Bog'lanish xatosi: ${e.message}`);
    process.exit(1);
  }

  const raw = await res.text();
  if (!res.ok) {
    console.error(`❌ Login xatolik (${res.status}): ${raw.substring(0, 300)}`);
    console.error("\nMumkin sabablar:");
    console.error("  - Email/parol noto'g'ri");
    console.error("  - Hisob admin emas (user/login kerak bo'lishi mumkin)");
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error(`❌ Javob JSON emas: ${raw.substring(0, 300)}`);
    process.exit(1);
  }

  // Javob shakli turlicha bo'lishi mumkin: {accessToken,refreshToken} | {data:{...}} | {token}
  const body = data.data && typeof data.data === "object" ? data.data : data;
  const accessToken = body.accessToken || body.access_token || body.token || body.bearerToken;
  const refreshToken = body.refreshToken || body.refresh_token;

  if (!accessToken || !refreshToken) {
    console.error("❌ Javobda token topilmadi. Xom javob:");
    console.error(JSON.stringify(data, null, 2).substring(0, 800));
    process.exit(1);
  }

  let newEnv = setEnvValue(envText, "MENTALABA_API_KEY", accessToken);
  newEnv = setEnvValue(newEnv, "MENTALABA_REFRESH_TOKEN", refreshToken);
  writeFileSync(ENV_PATH, newEnv);

  const a = decodeJwt(accessToken);
  const r = decodeJwt(refreshToken);
  const fmt = (s) => (s ? new Date(s * 1000).toISOString() : "?");
  console.log("✅ Yangi tokenlar .env ga yozildi!");
  console.log(`   ACCESS  exp: ${fmt(a?.exp)}`);
  console.log(`   REFRESH exp: ${fmt(r?.exp)}`);

  // API'ni tekshirish
  console.log("\n🧪 API tekshiruvi (universities?limit=1)...");
  const check = await fetch(`${apiUrl}/universities?limit=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (check.ok) {
    console.log(`✅ API ishlayapti (${check.status}) — data tool'lar tiklangan!`);
  } else {
    const t = await check.text().catch(() => "");
    console.log(`⚠️ API hali ham ${check.status}: ${t.substring(0, 200)}`);
    console.log("   (Ehtimol bu endpoint boshqa ruxsat talab qiladi — chat'ni qayta sinang)");
  }
}

main().catch((e) => {
  console.error("❌ Xatolik:", e.message);
  process.exit(1);
});
