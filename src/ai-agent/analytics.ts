/**
 * ANALYTICS (BOSQICH 7) — so'rovlarni kuzatish
 *
 * Har bir javob uchun strukturalangan log qaytaradi:
 *   intent | responseStrategy | provider | latencyMs | success | fallback | tool | cached
 *
 * Statistikani kuzatish uchun:
 *   - konsolga [Analytics] JSON satri chiqadi
 *   - (agar ANALYTICS_FILE yoqilgan bo'lsa) JSONL faylga yoziladi
 *
 * Misol:
 *   direction_search | template | 32 ms | success | tool=search_university
 *   recommendation   | llm      | 1260 ms | success | provider=groq
 */

export interface AnalyticsEntry {
  ts: string;
  intent: string;
  responseStrategy: string;
  provider: string;
  latencyMs: number;
  success: boolean;
  fallback: boolean;
  cached: boolean;
  tool: string;
  language: string;
  sessionId?: string;
}

/** Analitikani log qiladi (konsol + ixtiyoriy fayl) */
export function logAnalytics(entry: AnalyticsEntry): void {
  try {
    const line = JSON.stringify(entry);
    console.log(`[Analytics] ${line}`);

    // Faylga yozish faqat env yoqilganda — Next.js dev'da konsol yetarli
    const analyticsFile = process.env.ANALYTICS_FILE;
    if (analyticsFile) {
      // Dinamik import fs — brauzer/build xatolarini oldini olish uchun
      // (faqat Node runtime da ishlaydi)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require("fs") as typeof import("fs");
      fs.appendFileSync(analyticsFile, line + "\n", { encoding: "utf8" });
    }
  } catch (e: any) {
    // Analitika xatosi agent ishini buzmasligi kerak
    console.warn("[Analytics] log xatosi:", e?.message);
  }
}
