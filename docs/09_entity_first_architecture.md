# Entity-First AI Agent Arxitekturasi — Refactor Rejasi

> Holat: 2026-08-01
> Maqsad: Intent'lar sonini oshirish o'rniga **Entity extraction + Context management** ni kuchaytirish.
> Printsip: "Agentning haqiqiy aqli intentlarda emas, entity extraction va context management'da."

---

## 1. Hozirgi holat (2026-08-01)

### Mavjud (allaqachon ishlaydi)
| Qism | Holat |
|---|---|
| Intent classifier (16 ta intent) | ✅ Ishlaydi, rule-based + Step 2a–2f fallback'lar |
| `direction-synonyms.ts` (200+ sinonim, suffix-tolerant) | ✅ IT, tibbiyot, iqtisod, huquq, pedagogika, muhandislik, filologiya, san'at, sport, qishloq, turizm |
| Entity extraction | ⚠️ Qisman: university, direction, region, degree, language, educationType, institutionCategory, accommodation |
| Katalog intentlar (`direction_list`, `university_list`, `grant_list`, `news_list`) | ✅ API chaqiruvsiz/cheklangan |
| Follow-up context (`currentRegion`, `currentInstitutionCategory`, `currentDirectionCategory`, degree/language/byudjet) | ✅ degree/language/byudjet metadata'da saqlanadi va follow-up augmentatsiyada ishlatiladi |
| Tool router (`searchUniversity`, `searchDirection`, `searchTuition`, `searchGrants`, `searchNews`, `listDirections`, `recommend`) | ✅ entity'lar bilan dynamic filterlash ishlaydi (degree/language/educationType/byudjet) |
| JSON-driven intent config (`intent-config.json`) | ✅ Barcha intent pattern/tool/handler/priority/dataIntent/selfComplete — JSON'dan |
| LLM-assisted entity extraction | ✅ Provider bo'lsa LLM entity'larni aniqroq ajratadi, rule-based fallback |

### Bo'shliqlar (asosiy)
1. **Entity extraction cheklangan** — `tuitionMax` (byudjet), faculty, deadline yo'q ✅ (qo'shildi)
2. **Tools dynamic filtering qilmaydi** — `searchUniversity` degree/language/byudjet bilan FILTRLAMAYDI ✅ (qo'shildi)
3. **Follow-up context to'liq emas** — `currentDegree`, `currentLanguage` augmentatsiyada yo'q ✅ (qo'shildi)
4. **JSON-driven config yo'q** — intent/tool mapping kodda qattiq yozilgan ✅ (qo'shildi — BOSQICH 4)
5. **LLM-assisted extraction yo'q** — provider bo'lsa ham entity'lar rule-based topiladi ✅ (qo'shildi — BOSQICH 5)

---

## 2. Maqsadli arxitektura

```
User
  │
  ▼
Intent + Entity Extractor (rule-based + LLM-optional)
  │
  ▼
Context Manager (follow-up zanjiri: city → +category → +ownership → ...)
  │
  ▼
Tool Router (entity'larga asoslangan dynamic filter)
  │
  ▼
API Layer (external-api.ts)
  │
  ▼
Response Formatter (template / AI)
```

**Asosiy tamoyil:**
- Intent **ikkinchi darajali** — qaysi tool chaqirishni belgilaydi (15–25 ta umumiy tur)
- Entity **birinchi darajali** — qanday filtr qo'llashni belgilaydi (100+ qiymat)
- `"Toshkentdagi ingliz tilidagi xususiy tibbiyot universitetlari, kontrakti 30 mln gacha"` — bitta oqimda:
  - `intent: university_search`
  - `entities: { region: "14", language: "english", institutionCategory: "4", direction: "tibbiyot", tuitionMax: 30000000 }`

---

## 3. Bosqichlar

### BOSQICH 1 — Entity Model Kengaytirish (types + extractor)
**Maqsad:** Barcha muhim API fieldlarini entity'ga aylantirish.

`IntentResult.entities` ga qo'shish:
| Entity | Tur | Misol |
|---|---|---|
| `tuitionMax` | number (so'm) | "20 mln gacha" → 20000000 |
| `tuitionMin` | number (so'm) | "15 mln dan yuqori" → 15000000 |
| `faculty` | string | "stomatologiya fakulteti" |
| `deadline` | string | "qabul deadline'i qachon" |
| `newsCategory` | string | "grant yangiliklari" |
| `hasStipend` | boolean | "stipendiyali" |

**Fayllar:**
- `src/types/index.ts` — entities interfaceni kengaytirish
- `src/ai-agent/intent-classifier.ts` — `extractEntities` ga budget/faculty/deadline regex'lar
- Yangi modul: `src/ai-agent/entity-extractor.ts` (agar `extractEntities` juda katta bo'lib qolsa)

**Sinov:** test script'ga "20 mln gacha bo'lgan xususiy tibbiyot universitetlari" kabi holatlar.

---

### BOSQICH 2 — Dynamic Filtering (tool'lar entity'larga asoslanishi)
**Maqsad:** `searchUniversity`, `searchDirection`, `searchTuition`, `recommend` barcha entity'larni filtr sifatida ishlatishi.

- `searchUniversity`:
  - `region` ✅ (bor), `institutionCategory` ✅ (bor), `accommodation` ✅ (bor)
  - `degree` ❌ → user-side ma'lumotda `degree` array'ni tekshirish
  - `language` ❌ → `educationLanguage` array'ni tekshirish
  - `tuitionMax` ❌ → `minimalTuitionFee/maximalTuitionFee` bilan filtr
- `searchTuition`: `tuitionMax`/`tuitionMin` chegaralarni qo'llash
- `recommend`: barcha mavjud entity'larni preferences ga o'tkazish
- `searchDirection`: `degree` bo'yicha filtr (bakalavr/magistratura)

**Fayllar:**
- `src/ai-agent/tool-router.ts`

---

### BOSQICH 3 — Context Manager (follow-up zanjiri)
**Maqsad:** Context har so'rovda boyib boradi:
```
Toshkentdagi universitetlar → city=Toshkent
  ITlari → city=Toshkent, category=IT
    Davlatlari → city=Toshkent, category=IT, ownership=state
```

- `provider-manager.ts` follow-up augmentatsiyaga `currentDegree`, `currentLanguage`, `currentTuitionMax` qo'shish
- `chat/route.ts` metadata'da yangi entity'larni saqlash
- `SessionContext` kengaytirish

**Fayllar:**
- `src/types/index.ts`
- `src/ai-agent/provider-manager.ts`
- `src/app/api/v1/chat/route.ts`

---

### BOSQICH 4 — JSON-driven Config ✅ (bajarildi)
**Maqsad:** Yangi intent/tool qo'shish uchun kod emas, JSON yangilash.

**Nima qilindi:**
- `src/ai-agent/intent-config.json` — barcha intent'lar: `patterns` (regex stringlar), `keywords` (avtomatik `\bso'z\b`), `tool`, `handler`, `priority`, `dataIntent`, `selfComplete`. **Kalit tartibi = klassifikatsiya tartibi.**
- `src/ai-agent/intent-config.ts` — loader: pattern compile, `getIntentTool/Handler/Priority/DataFlag/Label`, `getSelfCompleteIntents()`, `validateIntentConfig()` (modul yuklanganda xato pattern darhol log'lanadi).
- `intent-classifier.ts` — pattern'lar endi config'dan (`compileAllIntentPatterns()`), confidence `priority` dan.
- `tool-router.ts` — switch o'rniga `HANDLER_DISPATCH` map + config'dan `handler` lookup.
- `provider-manager.ts` — `dataIntents` array o'rniga `getIntentDataFlag()`.
- `follow-up-context.ts` — `NON_ENHANCE_INTENTS` config'dan (`selfComplete` flag'i).

**Yangi intent qo'shish (kodga tegmasdan):**
```json
"yangi_intent": {
  "label": "Tavsif",
  "tool": "search_university",
  "handler": "search_university",
  "priority": 0.82,
  "dataIntent": true,
  "selfComplete": false,
  "patterns": ["(regex\s+string)"],
  "keywords": ["oddiy", "so'zlar"]
}
```

**Namoyish:** `university_detail` intent'i butunlay JSON orqali qo'shildi (`handler: search_university`) — "X universiteti haqida batafsil ma'lumot", "manzili qayerda", "kontaktlari bormi" so'rovlarini ushlaydi. TypeScript strict typing uchun `Intent` union'iga nom qo'shish ixtiyoriy (runtime'da kerak emas).

**Eslatma (muhim):** `keywords` asosan YANGI intent'lar uchun — mavjud intent'larning keyword'lari bo'sh (`[]`), chunki `\buniversitetlar\b` kabi keyword'lar katalog intent'larini noto'g'ri ushlab qolardi (masalan "Toshkentdagi universitetlar" → university_list). Mavjud intent'lar to'liq pattern'lar bilan aniqlanadi.

---

### BOSQICH 5 — LLM-assisted Entity Extraction ✅ (bajarildi)
**Maqsad:** Provider mavjud bo'lganda, LLM entity'larni aniqroq ajratadi.

**Nima qilindi:**
- `src/ai-agent/llm-entity-extractor.ts` (yangi) — **pure** modul:
  - `buildEntityExtractionPrompt()` — allowed keys/values ko'rsatilgan JSON so'rovi
  - `parseEntitiesJSON()` — javobni validatsiya qiladi: fence tozalash, region nom→id, alias'lar (BAKALAVR→bachelor, davlat→3, meditsina→tibbiyot...), "mln" heuristikasi, noto'g'ri kalitlarni filtrlash, garbage→null
- `provider-manager.ts`:
  - `extractEntitiesWithLLM()` — Groq→Gemini→OpenAI tartibida structured JSON output (6s timeout, xato → null)
  - `generateResponse` Step 1.7 — follow-up'dan keyin LLM entity refinement: `getIntentDataFlag(intent)` (katalog `*_list` intent'lari bundan mustasno — ular o'z-o'zidan to'liq) || admission/transfer. Xato/timeout/provider yo'q → **rule-based natija saqlanadi** (fallback)
  - **Merge policy:** konfliktda rule-based yutadi (`{ ...llmEntities, ...ruleBased }`) — LLM hallucination xavfini oldini oladi, LLM faqat rule-based topa olmagan bo'shliqlarni to'ldiradi. Real benchmark'dan keyin ayrim kalitlar uchun (masalan direction — rule-based false positive'lari bor) LLM ustunligini yoqish mumkin.
- `scripts/test-llm-entities.ts` — benchmark: rule-based vs LLM solishtirish (provider yo'q bo'lsa faqat rule-based)
- Test: `parseEntitiesJSON` unit test'lari (9 ta) — 138/138

**Real misol (LLM qiymati):** "Toshkent shahrida ingliz tilidagi xususiy bakalavr universitetlar" da rule-based `direction: filologiya` deb xato topadi ("tilidagi" → "til" sinonimi). LLM bunday false positive'larni yo'q qiladi.

---

## E2E Test natijalari (2026-08-02)

**Test:** "Toshkentdagi xususiy tibbiyot universitetlari, 20 mln gacha" → ilgari `direction_search` (xato), endi `university_search` ✅

**Topilgan va tuzatilgan bug'lar:**
1. **Pattern 8** (intent-config.json): region + universitet orasida 0–4 ta sifat so'zi ruxsat berildi (`{0,4}`, vergul/defis tolerantligi bilan) — "xususiy tibbiyot" kabi 2+ so'zli filter'lar ilgari mos kelmasdi.
2. **Step 2a** (intent-classifier.ts): kuchli/zaif signal bo'linishi — `yo'nalish/dastur/qiziqaman` har doim direction_search'ga o'tkazadi; `bakalavr/kunduzgi/IT` kabi degree/ta'lim shakli so'zlari faqat "universitet" so'zi YO'Q bo'lganda o'tkazadi (aks holda bu UNIVERSITY FILTRI). `hasUniversityRef` `\w*` bilan ko'plik shakllarini ushlaydi ("universitetlar").

**Ochiq muammo (environment):** `[Token Refresh Failed] 401` — `.env` dagi `MENTALABA_API_KEY`/`MENTALABA_REFRESH_TOKEN` muddati o'tgan. Token'lar yangilangach real ma'lumot oqadi.

**Keyingi bo'shliq:** `searchUniversity` `direction` entity'sini FILTRLAMAYDI (faqat region/kategoriya/daraja/til/ta'lim shakli/byudjet). "tibbiyot" entity'si ajratiladi, lekin qo'llanilmaydi — tibbiyot bo'lmagan xususiy universitetlar ham chiqadi. Fix: enriched ro'yxatdan keyin top-N universitetlarning yo'nalishlarini olib direction bo'yicha filterlash (searchDirection'da bor, searchUniversity'ga ko'chirish kerak).

---

## 4. Ustuvorliklar

| # | Bosqich | Qiymat | Xavf | Muddat |
|---|---|---|---|---|
| 1 | Entity model + extraction | 🟢 Yuqori | 🟢 Past | ~1 sessiya |
| 2 | Dynamic filtering | 🟢 Yuqori | 🟡 O'rta | ~1–2 sessiya |
| 3 | Context manager | 🟡 O'rta | 🟡 O'rta | ~1 sessiya |
| 4 | JSON config | 🟡 O'rta | 🔴 Yuqori | ~2+ sessiya |
| 5 | LLM extraction | 🟢 Yuqori | 🟡 O'rta | ~2+ sessiya |

---

## 5. Sinov strategiyasi

- `scripts/test-intent-synonyms.ts` — har bosqichda yangi holatlar qo'shish
- Har bosqich: `npx tsc --noEmit` + test + code review
- Benchmark (`scripts/benchmark.md` da reja) — real foydalanuvchi so'rovlari to'plami

---

## 6. Natija

Foydalanuvchi "Toshkentdagi ingliz tilidagi xususiy tibbiyot universitetlari, kontrakti 30 mln gacha"
desa, agent bitta oqimda:
1. `intent = university_search`
2. `entities = { region: 14, language: english, institutionCategory: 4, direction: tibbiyot, tuitionMax: 30_000_000 }`
3. `searchUniversity` bu entity'lar bilan filtrlaydi
4. Aniq, mos javob qaytaradi — FAQ ga tushib qolmaydi

---

## 7. O'zgartiriladigan fayllar xaritasi

| Fayl | Bosqich |
|---|---|
| `src/types/index.ts` | 1, 3 |
| `src/ai-agent/entity-extractor.ts` (yangi) | 1 |
| `src/ai-agent/intent-classifier.ts` | 1, 4 |
| `src/ai-agent/tool-router.ts` | 2 |
| `src/ai-agent/provider-manager.ts` | 3 |
| `src/app/api/v1/chat/route.ts` | 3 |
| `src/ai-agent/intent-config.json` (yangi) | 4 ✅ |
| `src/ai-agent/intent-config.ts` (yangi) | 4 ✅ |
| `src/ai-agent/tool-router.ts` (config dispatch) | 4 ✅ |
| `src/ai-agent/llm-entity-extractor.ts` (yangi) | 5 ✅ |
| `src/ai-agent/provider-manager.ts` (LLM entities) | 5 ✅ |
| `scripts/test-llm-entities.ts` (yangi) | 5 ✅ |
| `scripts/test-intent-synonyms.ts` | 1–5 (138 test) |
