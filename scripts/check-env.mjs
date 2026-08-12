// Vercel build paytida DATABASE_URL malformed bo'lsa aniq xato beradi
// (Prisma'ning "the URL must start with postgresql://" xabari noaniq).
// Bu skript hech narsani o'zgartirmaydi — faqat tekshiradi.
const url = process.env.DATABASE_URL || "";

if (!url) {
  console.error(
    "❌ DATABASE_URL env topilmadi!\n" +
      "   Vercel → Settings → Environment Variables → DATABASE_URL qo'shing."
  );
  process.exit(1);
}

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

console.log("✅ DATABASE_URL format to'g'ri");
