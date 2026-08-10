/**
 * GUEST SESSION CLEANUP (TTL)
 *
 * Login qilmagan (guest) foydalanuvchilarning session'lari tarixda ko'rinmaydi,
 * lekin DB'da saqlanadi (suhbat davomiyligi uchun kerak). Ularni cheksiz
 * yig'ib qo'ymaslik uchun — belgilangan kundan eski guest session'lar
 * o'chiriladi (xabarlari va feedback'lari bilan birga).
 *
 * Ishga tushirish:  npx tsx scripts/cleanup-guest-sessions.ts
 * (Vercel cron yoki oyiga bir marta qo'lda ishga tushiring)
 *
 * Eslatma: login qilingan user'lar session'lariga TEGILMAYDI. Guest bo'lib
 * qolib, keyin login qilgan (claim qilingan) session'lar ham saqlanadi.
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();

const DAYS = Number(process.env.GUEST_TTL_DAYS || 30);
const prisma = new PrismaClient();

async function main() {
  const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

  // 1) Eski guest session id'larini topamiz
  const stale = await prisma.chatSession.findMany({
    where: {
      userId: null,
      guestId: { not: null },
      updatedAt: { lt: cutoff },
    },
    select: { id: true },
  });

  const ids = stale.map((s) => s.id);
  if (ids.length === 0) {
    console.log(`✅ ${DAYS} kundan eski guest session topilmadi — hech narsa o'chirilmadi.`);
    return;
  }

  // 2) Feedback → Messages → Sessions (FK tartibi)
  const deleted = await prisma.$transaction([
    prisma.chatFeedback.deleteMany({ where: { sessionId: { in: ids } } }),
    prisma.chatMessage.deleteMany({ where: { sessionId: { in: ids } } }),
    prisma.chatSession.deleteMany({ where: { id: { in: ids } } }),
  ]);

  console.log(
    `🗑  ${ids.length} ta eski guest session o'chirildi (${DAYS} kundan eski): ` +
      `${deleted[2].count} session, ${deleted[1].count} xabar, ${deleted[0].count} feedback`
  );
}

main()
  .catch((e) => {
    console.error("[Cleanup Error]", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
