/**
 * TEST: Formatter output -> sanitizeText -> RichContent parser.
 * Reproduces the exact "tibbiyot yo'nalishi" direction_search path:
 * tool data (from user's log) -> getTemplateResponse output shape
 * -> sanitizeText (applied in chat route) -> frontend parseContent logic.
 */
process.env.GROQ_API_KEY = "";
process.env.GEMINI_API_KEY = "";
process.env.OPENAI_API_KEY = "";
process.env.JINA_API_KEY = "";

import { sanitizeText } from "../src/lib/sanitize-text";

// --- 1. Reconstruct what getTemplateResponse produces for the tool result in the log ---
const toolResult: any = {
  tool: "search_direction",
  success: true,
  data: {
    directions: [
      { id: 2581, nameUz: "Axborot texnologiyalari fanlari bakalavri - B.Sc. (IT)", nameEn: "Bachelor of Science in Information Technology - B.Sc. (IT)", universityId: 142, universityName: "Toshkent shahridagi Amity Universiteti", universitySlug: "toshkent-shahridagi-amity-universiteti" },
      { id: 4451, nameUz: "Biologiya", nameEn: "Biology", universityId: 177, universityName: "Xalqaro qishloq xo'jaligi universiteti", universitySlug: "xalqaro-qishloq-xojaligi-universiteti" },
      { id: 5440, nameUz: "Sanoat farmatsiyasi", nameEn: "Industrial pharmacy", universityId: 204, universityName: "Alfraganus universiteti", universitySlug: "alfraganus-universiteti" },
      { id: 5436, nameUz: "Stomatologiya", nameEn: "Dentistry", universityId: 204, universityName: "Alfraganus universiteti", universitySlug: "alfraganus-universiteti" },
    ],
    universities: [],
    tuitionInfo: { hasData: false },
  },
};

// --- 2. Mimic the formatter's fallback list branch (the one that runs when universities=[]) ---
const data = Array.isArray(toolResult.data.directions) ? toolResult.data.directions : [];
let raw = "### 📚 Yo'nalishlar\n\n";
raw += "Mana bir nechta variantlar:\n\n";
data.slice(0, 8).forEach((dir: any, i: number) => {
  raw += `${i + 1}. **${dir.nameUz || dir.nameEn}** ${dir.universityName ? `— ${dir.universityName}` : ''}\n`;
});
raw += `\n📌 **[Mentalaba.uz](https://mentalaba.uz/directions)** — barcha yo'nalishlar katalogi\n\nYana qanday yo'nalishlar qiziqtiradi? Yoki ma'lum bir universitet bo'yicha ko'rishni xohlaysizmi? 😊`;

console.log("=========== RAW (before sanitize, what formatter returns) ===========");
console.log(raw);

const sanitized = sanitizeText(raw);
console.log("\n=========== AFTER sanitizeText (what chat route saves/sends) ===========");
console.log(JSON.stringify(sanitized));
console.log("\n--- readable form ---");
console.log(sanitized);

// --- 3. Now feed sanitized content through RichContent.parseContent (replicated logic) ---
console.log("\n=========== FRONTEND PARSING (RichContent.parseContent) ===========");
const lines = sanitized.split("\n");
for (const line of lines) {
  const trimmed = line.trim();
  let label = "text";
  if (/^#{1,3}\s+(.+)+$/.test(trimmed)) label = "section-header";
  else if (trimmed.includes("|") && trimmed.match(/\b(University|Universitet|Turi|Manzil|Grant|To'lov)\b/i)) label = "comparison";
  else if (/^\d+\.\s+\*\*.*(?:yo'nalish|yonalish|direction)/i.test(trimmed)) label = "direction-card";
  else if (/^\d+\.\s+\*\*/.test(trimmed)) label = "numbered-item";
  else if (/^\*\*(\d+\.\s*)?(.+?)(?:\*\*)?\s*(🏛|🌍|🏢)?\s*(💰|🏠)?$/.test(trimmed) && (trimmed.includes("🏛") || trimmed.includes("🌍") || trimmed.includes("🏢"))) label = "university-card";
  console.log(`[${label}] ${trimmed.slice(0, 110)}`);
}

// --- 4. Simulate the "universities populated" branch too (the one that lists uni names) ---
console.log("\n=========== SIMULATE: universities populated branch ===========");
const uniList = [
  { fullNameUz: "Toshkent shahridagi Amity Universiteti", descriptionUz: "Tavsif...", institutionCategory: "Xalqaro", location: "Toshkent shahri", hasGrant: true, hasAccommodation: true, tuition: "25 - 36 mln so'm", phone: "+998 71 207 90 07", website: "https://amity.uz", isOpenForAdmission: false, slug: "toshkent-shahridagi-amity-universiteti" },
];
let raw2 = "### 🎓 Sizga mos universitetlar\n\n";
raw2 += `"tibbiyot" so'roviga mos **${uniList.length} ta** universitet topildi! 🎉\n\n`;
uniList.slice(0, 5).forEach((uni: any, i: number) => {
  raw2 += `---\n\n`;
  raw2 += `**${i + 1}. ${uni.fullNameUz || uni.fullNameEn}**\n\n`;
  if (uni.descriptionUz) raw2 += `${uni.descriptionUz.substring(0, 250)}\n\n`;
  if (uni.institutionCategory) raw2 += `📋 **Turi:** ${uni.institutionCategory}\n`;
  if (uni.location) raw2 += `📍 **Manzil:** ${uni.location}\n`;
  raw2 += `${uni.hasGrant ? '✅' : '❌'} **Grant:** ${uni.hasGrant ? 'Mavjud' : "Yo'q"}\n`;
  if (uni.slug) raw2 += `[🔍 Mentalaba.uz da batafsil ko'rish](https://mentalaba.uz/universities/${uni.slug})\n`;
});
const sanitized2 = sanitizeText(raw2);
console.log("--- sanitized output ---");
console.log(JSON.stringify(sanitized2));
console.log("\n--- lines parsed ---");
for (const line of sanitized2.split("\n")) {
  const trimmed = line.trim();
  let label = "text";
  if (/^#{1,3}\s+(.+)+$/.test(trimmed)) label = "section-header";
  else if (/^\d+\.\s+\*\*/.test(trimmed)) label = "numbered-item";
  else if (/^\*\*(\d+\.\s*)?(.+?)(?:\*\*)?\s*(🏛|🌍|🏢)?\s*(💰|🏠)?$/.test(trimmed) && (trimmed.includes("🏛") || trimmed.includes("🌍") || trimmed.includes("🏢"))) label = "university-card";
  console.log(`[${label}] ${trimmed.slice(0, 110)}`);
}

console.log("\n[DONE]");
