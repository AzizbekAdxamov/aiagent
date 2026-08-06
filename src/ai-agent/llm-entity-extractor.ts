/**
 * LLM-ASSISTED ENTITY EXTRACTION (BOSQICH 5)
 *
 * Provider mavjud bo'lganda message'dan entity'larni LLM orqali aniqroq ajratadi.
 * Rule-based natija fallback sifatida saqlanadi — LLM xato qilsa (timeout, bad JSON)
 * yoki provider bo'lmasa, intentClassifier.extractEntities natijasi ishlatiladi.
 *
 * Ushbu modul PURE (import qilmaydi) — faqat:
 *   - buildEntityExtractionPrompt(): LLM'ga yuboriladigan so'rov (allowed values bilan)
 *   - parseEntitiesJSON(): LLM javobini validatsiya qilib entity'larga aylantiradi
 *
 * Pure funksiyalar unit-test qilinadi (test-intent-synonyms.ts da), provider chaqiruvlari
 * esa provider-manager.ts da yashaydi.
 */

import type { IntentResult } from "@/types";

/** LLM qaytarishi mumkin bo'lgan entity kalitlari — faqat shular qabul qilinadi */
export const LLM_ENTITY_KEYS = [
  "university", "direction", "region", "degree", "language", "educationType",
  "institutionCategory", "accommodation", "tuitionMax", "tuitionMin",
  "faculty", "deadline", "newsCategory", "hasStipend",
] as const;

/** Region nomi → id (LLM nom qaytarsa id'ga aylantiramiz) */
export const REGION_NAME_TO_ID: Record<string, string> = {
  "qoraqalpog'iston": "1", "qoraqalpoq": "1", "nukus": "1",
  "andijon": "2", "buxoro": "3", "jizzax": "4",
  "qashqadaryo": "5", "qarshi": "5",
  "navoiy": "6", "namangan": "7", "samarqand": "8",
  "surxondaryo": "9", "termiz": "9", "sirdaryo": "10", "guliston": "10",
  "toshkent viloyati": "11", "farg'ona": "12", "fergana": "12", "fargona": "12",
  "xorazm": "13", "urganch": "13", "toshkent shahri": "14", "toshkent": "14",
};

/** Sinonimlarni kanonik qiymatlarga aylantiradi — LLM xilma-xil yozishlari uchun */
export const ENTITY_ALIASES: Record<string, Record<string, string>> = {
  degree: {
    bakalavr: "bachelor", bachelor: "bachelor", bsc: "bachelor",
    magistr: "master", magistratura: "master", master: "master", msc: "master",
    doktorantura: "phd", phd: "phd", "ph.d": "phd", phdstudent: "phd",
    transfer: "transfer", "ko'chirish": "transfer", kochirish: "transfer",
  },
  language: {
    "o'zbek": "uzbek", "o'zbekcha": "uzbek", uzbek: "uzbek", uz: "uzbek",
    ingliz: "english", "inglizcha": "english", english: "english", en: "english",
    rus: "russian", "ruscha": "russian", russian: "russian", ru: "russian",
  },
  educationType: {
    kunduzgi: "full-time", "full-time": "full-time", fulltime: "full-time", fulltime_edu: "full-time",
    sirtqi: "part-time", "part-time": "part-time", parttime: "part-time",
    kechki: "evening", evening: "evening",
    masofaviy: "distance", distance: "distance", online: "distance",
  },
  direction: {
    it: "it", dasturlash: "it", "axborot texnologiyalari": "it", programming: "it", computer: "it",
    tibbiyot: "tibbiyot", meditsina: "tibbiyot", medicine: "tibbiyot", shifokor: "tibbiyot", vrach: "tibbiyot", farmatsiya: "tibbiyot",
    iqtisod: "iqtisod", economics: "iqtisod", moliya: "iqtisod", finance: "iqtisod",
    huquq: "huquq", law: "huquq", yurisprudensiya: "huquq",
    pedagogika: "pedagogika", pedagogy: "pedagogika", "o'qituvchi": "pedagogika",
    muhandislik: "muhandislik", engineering: "muhandislik", qurilish: "muhandislik",
    filologiya: "filologiya", philology: "filologiya", tillar: "filologiya",
    sanat: "sanat", "san'at": "sanat", art: "sanat", dizayn: "sanat",
    sport: "sport", physical: "sport",
    qishloq: "qishloq", "qishloq xo'jaligi": "qishloq", agriculture: "qishloq",
    turizm: "turizm", tourism: "turizm", hospitality: "turizm",
  },
  institutionCategory: {
    "3": "3", davlat: "3", state: "3", public: "3",
    "4": "4", xususiy: "4", private: "4", nodavlat: "4",
    "5": "5", xalqaro: "5", international: "5",
  },
  newsCategory: {
    grant: "grant", grants: "grant", stipendiya: "grant",
    sport: "sport", sports: "sport", futbol: "sport",
    university: "university", universities: "university",
    admission: "admission", qabul: "admission",
  },
};

/**
 * LLM'ga yuboriladigan so'rov (structured JSON output uchun).
 * Allowed keys/values prompt'da ko'rsatiladi — hallucination kamayadi.
 */
export function buildEntityExtractionPrompt(message: string, language: string): string {
  return `You are a precise entity extractor for an Uzbekistan university advisor bot.
Extract structured entities from the user's message (written in ${language}).

Return ONLY valid JSON — no markdown, no explanation, no comments.

Allowed keys and values:
- "university": string — university name if clearly mentioned (e.g. "Amity Universiteti", "TATU", "Samarqand davlat universiteti")
- "direction": one of ["it","tibbiyot","iqtisod","huquq","pedagogika","muhandislik","filologiya","sanat","sport","qishloq","turizm"]
- "region": one of ["1"(Qoraqalpog'iston),"2"(Andijon),"3"(Buxoro),"4"(Jizzax),"5"(Qashqadaryo),"6"(Navoiy),"7"(Namangan),"8"(Samarqand),"9"(Surxondaryo),"10"(Sirdaryo),"11"(Toshkent viloyati),"12"(Farg'ona),"13"(Xorazm),"14"(Toshkent shahri),"15"(Boshqa)] — or the region NAME (e.g. "Toshkent shahri"), it will be mapped
- "degree": one of ["bachelor","master","phd","transfer"] (bakalavr→bachelor, magistr→master, doktorantura→phd)
- "language": one of ["uzbek","english","russian"] (ingliz→english, rus→russian, o'zbek→uzbek)
- "educationType": one of ["full-time","part-time","evening","distance"] (kunduzgi→full-time, sirtqi→part-time, masofaviy→distance)
- "institutionCategory": one of ["3"(davlat/state),"4"(xususiy/private),"5"(xalqaro/international)]
- "accommodation": "true" if dormitory (yotoqxona) is requested
- "tuitionMax": number in UZS so'm (e.g. 20000000 for "20 mln gacha")
- "tuitionMin": number in UZS so'm
- "faculty": string — faculty name (e.g. "stomatologiya")
- "deadline": "deadline" if admission deadline is asked
- "newsCategory": one of ["grant","sport","university","admission"]
- "hasStipend": true or false if stipendiya asked

CRITICAL RULES:
- Include ONLY keys you are confident are mentioned. Omit everything else.
- If nothing is mentioned, return {}.
- Do NOT guess or hallucinate values.
- IMPORTANT: "doktor", "shifokor", "vrach" (doctor as a PROFESSION / shifokorlik kasbi) is a DIRECTION (tibbiyot), NOT a degree! Only "doktorantura", "phd", "PhD", "fan doktori" map to degree=phd.
- IMPORTANT: "dasturchi", "programmer", "informatik" (developer as a PROFESSION) is a DIRECTION (it), not a degree.
- IMPORTANT: "o'qituvchi", "pedagog" (teacher as a PROFESSION) is a DIRECTION (pedagogika), not a degree.
- IMPORTANT: "huquqshunos", "advokat", "yurist" (lawyer as a PROFESSION) is a DIRECTION (huquq), not a degree.
- IMPORTANT: "iqtisodchi", "buxgalter" (economist as a PROFESSION) is a DIRECTION (iqtisod), not a degree.
- "degree" should be set ONLY when an explicit academic level word is used: "bakalavr", "magistr", "magistratura", "doktorantura", "phd", "bachelor", "master".

User message: """${message}"""

Return JSON:`;
}

/** JSON matndan kod bloklarini (```json ... ```) va qo'shimcha matnni tozalaydi */
export function extractJsonObject(text: string): string {
  let t = (text || "").trim();
  // ```json ... ``` yoki ``` ... ``` bloklarni olib tashlash
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  // Birinchi { dan oxirgi } gacha (JSON'gacha/so'ng matn bo'lishi mumkin)
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return t.substring(start, end + 1);
  }
  return t;
}

/** Raqamni so'mga aylantiradi + "mln" heuristikasi (LLM "20" yoki "20 mln" qaytarishi mumkin) */
function coerceNumber(value: unknown, message: string): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").replace(/\s+/g, "").toLowerCase();
    const num = parseFloat(cleaned);
    if (Number.isNaN(num)) return null;
    const lowerMsg = message.toLowerCase();
    if (num < 1_000_000 && (lowerMsg.includes("mln") || lowerMsg.includes("million") || lowerMsg.includes("milyon"))) {
      return Math.round(num * 1_000_000);
    }
    return num;
  }
  return null;
}

/**
 * LLM javobini validatsiya qilib, entity'larga aylantiradi.
 * Xato JSON / noto'g'ri kalitlar → null yoki bo'sh object. Hech qachon throw qilmaydi.
 */
export function parseEntitiesJSON(text: string, message: string = ""): IntentResult["entities"] | null {
  try {
    const jsonText = extractJsonObject(text);
    if (!jsonText || jsonText === "{}" || jsonText === "[]") return {};

    const raw = JSON.parse(jsonText);
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;

    const entities: IntentResult["entities"] = {};
    for (const key of LLM_ENTITY_KEYS) {
      const value = (raw as any)[key];
      if (value === undefined || value === null || value === "") continue;

      switch (key) {
        case "university":
        case "faculty":
          if (typeof value === "string") (entities as any)[key] = value.trim();
          break;
        case "direction":
        case "degree":
        case "language":
        case "educationType":
        case "newsCategory": {
          if (typeof value === "string") {
            const canonical = ENTITY_ALIASES[key]?.[value.toLowerCase().trim()];
            if (canonical) (entities as any)[key] = canonical;
          }
          break;
        }
        case "region": {
          const normalized = String(value).toLowerCase().trim();
          if (/^\d{1,2}$/.test(normalized)) {
            const id = parseInt(normalized, 10);
            if (id >= 1 && id <= 15) entities.region = String(id);
          } else if (REGION_NAME_TO_ID[normalized]) {
            entities.region = REGION_NAME_TO_ID[normalized];
          }
          break;
        }
        case "institutionCategory": {
          // Fix: LLM bir nechta kategoriya qaytarsa ("davlat yoki xalqaro" →
          // ["3","5"]) barchasi saqlanadi — rule-based classifier bilan bir xil.
          const canonical = ENTITY_ALIASES.institutionCategory?.[String(value).toLowerCase().trim()];
          if (canonical) entities.institutionCategory = canonical;
          if (Array.isArray(value)) {
            const cats: string[] = [];
            for (const v of value) {
              const c = ENTITY_ALIASES.institutionCategory?.[String(v).toLowerCase().trim()];
              if (c && !cats.includes(c)) cats.push(c);
            }
            if (cats.length > 0) {
              entities.institutionCategories = cats;
              if (!entities.institutionCategory) entities.institutionCategory = cats[0];
            }
          }
          break;
        }
        case "accommodation": {
          const v = String(value).toLowerCase();
          if (["true", "yes", "1", "bor"].includes(v)) entities.accommodation = "true";
          break;
        }
        case "tuitionMax":
        case "tuitionMin": {
          const num = coerceNumber(value, message);
          if (num !== null && num > 0) {
            if (key === "tuitionMax") entities.tuitionMax = num;
            else entities.tuitionMin = num;
          }
          break;
        }
        case "deadline":
          // Qulay: LLM "deadline", "qabul muddati", "muddat" kabi istalgancha yozishi mumkin
          if (typeof value === "string" && value.trim().length > 0) entities.deadline = value.trim().toLowerCase();
          break;
        case "hasStipend": {
          const v = String(value).toLowerCase();
          if (["true", "yes", "1"].includes(v)) entities.hasStipend = true;
          else if (["false", "no", "0"].includes(v)) entities.hasStipend = false;
          break;
        }
      }
    }
    return entities;
  } catch {
    return null;
  }
}
