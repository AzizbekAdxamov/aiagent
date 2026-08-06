/**
 * Foydalanuvchi matnini normallashtirish (typo tolerance) — UMUMIY modul.
 *
 * NEGA ALOHIDA MODUL:
 * - intent-classifier ham, tool-router ham foydalanuvchi matnini bir xil
 *   normallashtirishi kerak. Ilgari normalizeText faqat classifier ichida bor edi,
 *   tool-router esa RAW matn bilan ishlardi — natijada:
 *   "daturchi bolmoqchiman" → classifier: direction_search (it) ✅
 *                            → tool keyword: "daturchi" → bo'sh natija ❌
 *   (classifier typoni tuzatadi, lekin tool RAW "daturchi" bilan qidiradi!)
 *
 * Qoida: faqat ANIQ typolarni tuzatadi, to'g'ri so'zlarni buzmaydi.
 */
export function normalizeUserText(text: string): string {
  let t = text.toLowerCase().trim();

  // universitet typolari (faqat aniq xatolar!)
  t = t.replace(/universitei/gi, 'universiteti');
  t = t.replace(/universitela/gi, 'universitetla');   // "universitelar" → "universitetlar"
  t = t.replace(/univers?ty/gi, 'university');       // "universty" → "university", "universiy" → "university"
  t = t.replace(/unversitet/gi, 'universitet');
  t = t.replace(/unniversitet/gi, 'universitet');
  t = t.replace(/univ\s+ersitet/gi, 'universitet');
  t = t.replace(/universtit/gi, 'universitet');      // "universtitlar" → "universitetlar" (st->t xato)
  t = t.replace(/universitat/gi, 'universitet');     // "universitati" → "universiteti"

  // ma'lumot typolari
  t = t.replace(/malumot/gi, "ma'lumot");           // "malumot" → "ma'lumot"

  // shahar typolari
  t = t.replace(/shax(ri|rida|ridagi)/gi, 'shah$1');   // "shaxri" → "shahri", "shaxrida" → "shahrida", "shaxridagi" → "shahridagi"
  t = t.replace(/shari?[dt]an/gi, 'shahridan');
  t = t.replace(/shardan/gi, 'shahridan');
  t = t.replace(/sh(a|ax)ridan/gi, 'shahridan');

  // yo'nalish typolari
  t = t.replace(/yonali?sh/gi, "yo'nalish");
  t = t.replace(/yonalis/gi, "yo'nalish");

  // qiziqish typolari
  t = t.replace(/qiziaman/gi, 'qiziqaman');

  // o'qish typolari
  t = t.replace(/oqish/gi, "o'qish");
  t = t.replace(/oqimoq/gi, "o'qimoq");

  // kasb/istak typolari — apostrof tushib qolishi juda keng tarqalgan
  // "bolmoqchiman" → "bo'lmoqchiman", "bolishni" → "bo'lishni"
  // "men bolmoqchiman" → direction_search bo'lishi kerak, faq EMAS!
  t = t.replace(/bolmoqchiman/gi, "bo'lmoqchiman");
  t = t.replace(/bolmoqchisan/gi, "bo'lmoqchisan");
  t = t.replace(/bolishni/gi, "bo'lishni");
  t = t.replace(/bolishga/gi, "bo'lishga");
  t = t.replace(/bolaman/gi, "bo'laman");

  // dasturchi typolari — 's' tushib qolishi: "daturchi", "dasturci"
  // "daturchi bolmoqchiman" → direction_search (IT) bo'lishi kerak!
  t = t.replace(/daturchi/gi, 'dasturchi');
  t = t.replace(/dasturci/gi, 'dasturchi');
  t = t.replace(/dasturchsi/gi, 'dasturchi');
  t = t.replace(/dasturlaw/gi, 'dasturlash');       // "dasturlaw" → "dasturlash" (w->sh)
  t = t.replace(/dasturlav/gi, 'dasturlash');       // "dasturlav" → "dasturlash"
  t = t.replace(/dasturlawsh/gi, 'dasturlash');     // "dasturlawsh" → "dasturlash"

  // kompyuter typolari — 'e' tushib qolishi: "kompyutr", "kompyter"
  t = t.replace(/kompyutr/gi, 'kompyuter');
  t = t.replace(/kompyter/gi, 'kompyuter');
  t = t.replace(/kompuyter/gi, 'kompyuter');
  t = t.replace(/kompyutar/gi, 'kompyuter');
  t = t.replace(/komputr/gi, 'kompyuter');

  // institut / instituti typo tolerance
  t = t.replace(/insituti/gi, 'institut');
  t = t.replace(/instituti/gi, 'institut');
  t = t.replace(/insitute/gi, 'institut');
  t = t.replace(/institution/gi, 'institut');

  // toshkent typolari
  t = t.replace(/toshkendan/gi, 'toshkentdan');   // "toshkendan" → "toshkentdan"

  // tibbiyot typolari — bitta 'b' tushib qolishi: "tibiyot", "tibbiyot"
  t = t.replace(/tibiyot/gi, 'tibbiyot');

  // kontrakt / narx typolari
  // "kantrakt narxlaari" → "kontrakt narxlari" (foydalanuvchi xato yozganda ham
  // tuition_search aniqlanishi kerak)
  t = t.replace(/kantrakt|kontarkt|kontratk/gi, 'kontrakt');
  // MUHIM: faqat so'z chegarasida (\b...\b)! "grantla" → "grantlar" typo,
  // lekin "grantlar" ichidagi "grantla" substringiga tegib ketmasligi kerak
  // (aks holda "grantlar" → "grantlarr" bo'lib, grant_list patterni buziladi).
  t = t.replace(/\bgrantla\b/gi, 'grantlar');
  t = t.replace(/\bkontraktla\b/gi, 'kontraktlar');   // "kontraktla" → "kontraktlar" (r tushib qolishi)

  // grant typolari — "narxlaari", "grantla" aralashmalari
  t = t.replace(/narxlaa?ri/gi, 'narxlari');      // "narxlaari" → "narxlari"
  t = t.replace(/narxalari/gi, 'narxlari');        // "narxalari" → "narxlari"
  t = t.replace(/narhlaa?ri/gi, 'narhlari');       // "narhlaari" → "narhlari"
  t = t.replace(/to'lovlaa?ri/gi, "to'lovlari");  // "to'lovlaari" → "to'lovlari"

  return t;
}
