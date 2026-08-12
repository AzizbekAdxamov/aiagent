import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Neon free-tier DB'lar bir necha daqiqa harakatsizlikdan keyin AVTO-PAUSE
 * bo'ladi. Uyg'onish 5-15 soniya oladi — connect_timeout bo'lmasa ulanish
 * 15s'da timeout bo'lib, chat so'rovi 500 qaytaradi. connect_timeout=30
 * bilan Prisma uyg'onishni kutadi.
 */
function buildDatabaseUrl(): string {
  const base = process.env.DATABASE_URL || "";
  if (!base) return base;
  if (base.includes("connect_timeout=")) return base;
  return base.includes("?")
    ? `${base}&connect_timeout=30`
    : `${base}?connect_timeout=30`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: buildDatabaseUrl() } },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Neon auto-pause (free tier) tufayli DB ulanishi uzilganda qayta urinadi.
 * - P1001: DB serverga yetib bo'lmayapti (paused)
 * - P1017: server ulanishni yopdi
 * - P2024: connection pool timeout (barcha ulanishlar band)
 * - P1008: operation timed out (wake-up paytida)
 * Boshqa xatolar (validatsiya, topilmadi, so'rov xatosi) qayta urinilmaydi.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const code = (error as { code?: string })?.code;
      const isConnectionError =
        code === "P1001" || code === "P1017" || code === "P2024" || code === "P1008";
      if (!isConnectionError) throw error;
      if (i < attempts - 1) {
        console.warn(
          `[DB Retry] ${code} — urinish ${i + 1}/${attempts}, Neon uyg'onmoqda...`
        );
        await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
      }
    }
  }
  throw lastError;
}

export default prisma;
