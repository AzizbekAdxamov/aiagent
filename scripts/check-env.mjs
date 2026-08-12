// Vercel build paytida DATABASE_URL noto'g'ri bo'lsa aniq xato beradi
// (Prisma'ning P1013 / "must start with postgresql://" xabarlari noaniq).
// Bu skript hech narsani o'zgartirmaydi — faqat tekshiradi.
const url = process.env.DATABASE_URL || "";

if (!url) {
  console.error(
    "❌ DATABASE_URL env topilmadi!\n" +
      "   Vercel → Settings → Environment Variables → DATABASE_URL qo'shing."
  );
  process.exit(1);
}

// 1) Protokol tekshiruvi
if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
  console.error(
    "❌ DATABASE_URL 'postgresql://' bilan boshlanishi kerak!\n" +
      `   Hozirgi qiymat boshidagi belgilar: ${JSON.stringify(url.slice(0, 50))}\n` +
      "   Ehtimol qiymat qo'shtirnoq (\") yoki bo'sh joy bilan kiritilgan — olib tashlang.\n" +
      "   To'g'ri format: postgresql://USER:PASS@host/db?sslmode=require&connect_timeout=30\n" +
      "   Qiymatni lokal backend/.env faylidan to'liq ko'chirib qo'ying."
  );
  process.exit(1);
}

// 2) Prisma qo'llab-quvvatlamaydigan URL parametrlari (P1013 xatosi!)
// Neon psql URL'larida `channel_binding=require` bo'ladi — Prisma uni tanimaydi.
// Boshqa neon-specific / qo'llab-quvvatlanmaydigan parametrlarni ham ushlaymiz.
const SUPPORTED_PARAMS = new Set([
  "sslmode",
  "connect_timeout",
  "pool_timeout",
  "connection_limit",
  "schema",
  "socket_timeout",
  "application_name",
  "sslcert",
  "sslidentity",
  "sslpassword",
  "sslrootcert",
  "host",
  "port",
  "user",
  "password",
  "db",
  "statement_cache_size",
  "options",
  "keepalives",
  "keepalives_idle",
  "tcp_user_timeout",
  "sslsni",
]);

const UNSUPPORTED_COMMON = ["channel_binding", "pool_mode", "pgbouncer", "endpoint"];

const queryPart = url.split("?")[1] || "";
const badParams = [];
if (queryPart) {
  for (const piece of queryPart.split("&")) {
    if (!piece) continue;
    const key = piece.split("=")[0];
    if (!key) continue;
    const lower = key.toLowerCase();
    if (UNSUPPORTED_COMMON.includes(lower)) {
      badParams.push(`"${key}" (Neon psql parametri — Prisma uni qo'llab-quvvatlamaydi)`);
    } else if (!SUPPORTED_PARAMS.has(lower)) {
      badParams.push(`"${key}" (Prisma tomonidan tanilmaydi)`);
    }
  }
}
if (badParams.length > 0) {
  console.error(
    "❌ DATABASE_URL'da Prisma qo'llab-quvvatlamaydigan parametr(lar) bor — P1013 xatosi!\n" +
      `   Topilgan: ${badParams.join("; ")}\n` +
      "   YECHIM: Vercel → Settings → Environment Variables → DATABASE_URL → Edit →\n" +
      "   parametr qismidan noto'g'ri parametrni olib tashlang.\n" +
      "   To'g'ri misol: postgresql://USER:PASS@host/db?sslmode=require&connect_timeout=30\n" +
      "   (channel_binding faqat psql uchun — Prisma'da ishlamaydi!)"
  );
  process.exit(1);
}

// 3) Placeholder tekshiruvi — misol URL ko'chirilgan, lekin qiymatlar almashtirilmagan
const lower = url.toLowerCase();
if (
  lower.includes("@host/") ||
  lower.includes("@localhost/") ||
  lower.includes("user:pass@") ||
  lower.includes("username:password@") ||
  lower.includes(":yourpassword@") ||
  lower.includes("example.com") ||
  lower.includes("your-db") ||
  lower.includes("yourhost")
) {
  console.error(
    "❌ DATABASE_URL'da ALMASHTIRILMAGAN placeholder bor!\n" +
      `   Hozirgi qiymat boshidagi belgilar: ${JSON.stringify(url.slice(0, 60))}\n` +
      "   Misol URL ko'chirilgan, lekin USER:PASS@host/db qismi HAQIQIY qiymatlar bilan\n" +
      "   almashtirilmagan. Vercel → Settings → Environment Variables → DATABASE_URL → Edit →\n" +
      "   qiymatni lokal backend/.env faylidagi DATABASE_URL'dan TO'LIQ ko'chirib qo'ying\n" +
      "   (parol va host birga, o'zgartirmasdan!)."
  );
  process.exit(1);
}

// 4) Qo'shtirnoq / bo'sh joy / ikki ? tekshiruvi
if (url.includes('"') || url.includes("'") || url.includes(" ") || url.includes("?" + "?")) {
  console.error(
    "❌ DATABASE_URL'da noto'g'ri belgi bor: qo'shtirnoq, bo'sh joy yoki ikki '?'\n" +
      `   Hozirgi qiymat boshidagi belgilar: ${JSON.stringify(url.slice(0, 60))}\n` +
      "   Toza qiymat kiriting: postgresql://USER:PASS@host/db?sslmode=require&connect_timeout=30"
  );
  process.exit(1);
}

console.log("✅ DATABASE_URL format to'g'ri");
