/**
 * CANONICAL ALIAS TABLE (BOSQICH 20 — Entity Resolution)
 *
 * Foydalanuvchi qisqartmalari → DB'dagi canonical slug.
 *
 * NEGA KERAK (user qoidasi: "Topilmagan entity'ni hech qachon model o'zi
 * o'ylab topmasin"):
 *  - TATU/TUIT, INHA/IUT, TTA/TMA kabi qisqartmalar turlicha yoziladi, lekin
 *    DB'da faqat bittasi abbr sifatida saqlangan. "TUIT" degan user DB'da
 *    topilmasa, agent aniqlik so'rashi yoki noto'g'ri universitеtni olishi
 *    mumkin — bu jadval bunday variantlarni canonical universitеtga yopadi.
 *  - "TATU" → Toshkent axborot texnologiyalari (Arxitektura-Qurilish EMAS).
 *    Arxitektura-Qurilishning DB'dagi abbr'i "TAQU" — "TAQI"/"TASI" (eski
 *    nomlar) ham shu universitеtga map qilinadi.
 *
 * TEKSHIRUV: scripts/check-university-aliases.ts live API'dagi ro'yxat bilan
 * ushbu jadvalni tasdiqlaydi (slug borligi, DB abbr bilan mosligi, konfliktlar).
 */

/**
 * Qisqartma (UPPERCASE) → canonical slug (DB'dagi `slug` maydoni).
 * FAQAT DB'da abbr sifatida YO'Q bo'lgan user-qisqartmalari shu yerda —
 * DB'da mavjud abbr'lar exact match orqali o'z-o'zidan ishlaydi.
 */
export const UNIVERSITY_ALIASES: Record<string, string> = {
  // ── TATU oilasi (axborot texnologiyalari) ──
  "TUIT": "toshkent-axborot-texnologiyalari-universiteti", // English abbr (DB: TATU)
  "INHA": "inha-university-in-tashkent",                  // DB'da IUT deb saqlangan
  "TTA": "toshkent-tibbiyot-akademiyasi",                 // ruscha qisqartma (DB: TMA)
  "TMCI": "xalqaro-tmc-instituti",                        // DB: TMC
  "TAQI": "toshkent-arxitektura-qurilish-universiteti",   // eski nom (DB: TAQU)
  "TASI": "toshkent-arxitektura-qurilish-universiteti",   // English abbr (DB: TAQU)
  "TDIU": "toshkent-davlat-iqtisodiyot-universiteti",     // DB: TSUE
  "TDYU": "toshkent-davlat-yuridik-universiteti",         // DB: TSUL
  "TMI": "toshkent-moliya-instituti",                     // DB: TFI
  "TKTU": "toshkent-kimyo-texnologiya-instituti",         // DB: TKTI
  "TKXU": "toshkent-kimyo-xalqaro-universiteti",          // DB: KIUT
  "TOSHDTU": "islom-karimov-nomidagi-toshkent-davlat-texnika-universiteti-qoshma-talim", // DB: TDTU
  "TOSHFA": "toshkent-farmatsevtika-instituti",           // DB: PHARMI
  "MDIS": "toshkent-shahridagi-singapur-menejmentni-rivojlantirish-instituti", // DB: TSMRI
  "SAMSI": "samarqand-iqtisodiyot-va-servis-instituti",   // DB: SIES
  "TAFU": "toshkent-amaliy-fanlar-universiteti",          // DB: UTAS
  "WESTMINSTER": "westminster-international-university-in-tashkent", // DB: WIUT

  // ── Viloyat OTM'lari ──
  "FARDU": "fargona-davlat-universiteti",                 // DB: FDU
  "ANDDU": "andijon-davlat-universiteti",                 // DB: ADU
  "QARDU": "qarshi-davlat-universiteti",                  // DB: QARSHIDU
  "TERDU": "termiz-davlat-universiteti",                  // DB: TERSU
  "NAVDPI": "navoiy-davlat-pedagogika-universiteti",      // DB: NAVSPI
};

/**
 * Kod regex'larida taniladigan barcha qisqartmalar — checker unmapped
 * qisqartmalarni topib, jadval to'ldirilishini eslatadi.
 * (intent-classifier / follow-up-context / intent-config dagi regexlar bilan
 * sinxron saqlanadi.)
 */
export const KNOWN_CODE_ABBREVIATIONS: string[] = [
  "PDP", "INHA", "WIUT", "TATU", "TUIT", "EMU", "TMC", "TMCI", "SAMDU",
  "ADU", "MIS", "MESI", "TKXU", "TKTU", "TDTU", "TDIU", "TDYU", "TTA",
  "TTPI", "TATI", "SAMSI", "BUXDU", "FARDU", "NAMDU", "URDU", "QARDU",
  "ANDDU", "TERDU", "NAVDPI", "JDPU", "TDPU", "TOSHDTU", "TOSHKEU", "TMI",
  "TQI", "TOSHFA", "TOSHSEI", "TAFU", "AMITY", "WESTMINSTER", "MDIS",
];

/**
 * Alias orqali universitеtni topadi. Target qisqartma jadvalda bo'lsa,
 * canonical slug'ga mos universitеtni qaytaradi (deterministik — LLM EMAS).
 * Jadvalda yo'q bo'lsa null — chaqiruvchi keyingi qatlamlarga o'tadi
 * (DB abbr exact match → nom substring → kalit so'zlar).
 */
export function resolveAliasedUniversity(
  target: string | undefined | null,
  universities: any[]
): any | null {
  if (!target || !Array.isArray(universities) || universities.length === 0) return null;
  const key = String(target).toUpperCase().trim();
  const slug = UNIVERSITY_ALIASES[key];
  if (!slug) return null;
  return (
    universities.find(
      (u: any) => String(u.slug || u.slugUz || "").toLowerCase() === slug
    ) || null
  );
}
