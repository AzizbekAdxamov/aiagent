/**
 * CACHE LAYER (BOSQICH 7) — Memory Response Cache
 *
 * Nima uchun: bir xil so'rov ("Toshkentdagi IT universitetlari") har safar
 * API'ga (filter + user-side) boradi. Bu server yukini oshiradi.
 *
 * Yechim: template (0 token) javoblarni memory cache da saqlaymiz —
 *   Key:  intent|effectiveMessage|language
 *   TTL:  10 daqiqa
 *   Limit: 500 ta (LRU)
 *
 * Faqat TEMPLATE strategiya javoblari cache qilinadi (deterministik).
 * LLM javoblari cache qilinmaydi — ular kontekstga bog'liq.
 *
 * MUHIM: follow-up kontekstlari effectiveMessage ga qo'shilgani uchun
 * ("Toshkent shahri IT davlatlari") — har xil dialoglar har xil kalit oladi.
 */

interface CacheEntry {
  content: string;
  provider: string;
  toolUsed: string;
  intent: string;
  expiresAt: number;
}

class ResponseCache {
  private store = new Map<string, CacheEntry>();
  private readonly TTL_MS = 10 * 60 * 1000; // 10 daqiqa
  private readonly MAX_SIZE = 500;

  /** Kalit qurish: intent + effectiveMessage + language (normalizatsiya bilan) */
  buildKey(intent: string, effectiveMessage: string, language: string): string {
    const norm = effectiveMessage
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    // MUHIM (fix): oldin faqat birinchi 200 belgi olinardi — uzun (follow-up
    // kontekst bilan boyitilgan) xabarlar bir xil prefiksga ega bo'lib
    // qolganda turli so'rovlar bir-birining cache javobini olib qo'yardi.
    // Endi to'liq normalizatsiya qilingan matn ishlatiladi — kollizyo yo'q.
    return `${intent}|${norm}|${language}`;
  }

  /** Cache dan o'qiydi — muddati o'tgan yoki yo'q bo'lsa null */
  get(key: string): CacheEntry | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  /** Cache ga yozadi — LRU + limit */
  set(key: string, entry: Omit<CacheEntry, "expiresAt">): void {
    // Agar eski qiymat bo'lsa o'chiramiz (LRU pozitsiyasini yangilash uchun)
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { ...entry, expiresAt: Date.now() + this.TTL_MS });

    // Limitdan oshsa — eng eskisini o'chiramiz (Map iteratsiya tartibi = qo'shilish tartibi)
    if (this.store.size > this.MAX_SIZE) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }
  }

  /** Statistika */
  size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}

export const responseCache = new ResponseCache();
