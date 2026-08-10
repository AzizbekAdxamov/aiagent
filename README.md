# 🤖 Mentalaba AI Agent

O'zbekiston talabalari uchun sun'iy intellektli universitet maslahatchisi — Mentalaba.uz ma'lumotlar bazasi (universitetlar, yo'nalishlar, grantlar, yangiliklar) ustida ishlaydigan konversatsion AI agent.

## 🚀 Asosiy imkoniyatlar

| Imkoniyat | Tavsif |
|---|---|
| 🏛 **Universitet qidiruv** | Shahar, viloyat, davlat/xususiy/xalqaro, yo'nalish, til bo'yicha filtr |
| 📚 **Yo'nalish qidiruv** | IT, tibbiyot, iqtisod, pedagogika va boshqa 50+ kategoriya, sinonimlar bilan |
| 💰 **Kontrakt narxlari** | Universitet bo'yicha kontrakt, byudjet chegarasi filteri |
| 🎯 **Tavsiya (recommendation)** | Foydalanuvchi profiliga mos universitetlarni scoring (0–100) bilan tavsiya qilish |
| 💬 **Conversation memory** | `lastUniversity`, `lastDirection`, `lastRecommendation` — follow-up savollar (`uning narxi?`, `telefoni?`) oldingi suhbatga bog'lanadi |
| 🔁 **Follow-up / Nav / Repair** | "Keyingisi-chi?", "Birinchi tavsiya qilingan uni haqida", "Yo'q men TATUni aytgandim" |
| ⚡ **Response Strategy** | `template` (95% — API ma'lumot, 0 token) / `hybrid` / `llm` (5% — reasoning) |
| 🔀 **Multi-provider fallback** | Groq → OpenRouter → DeepSeek → Gemini — birida limit tugasa avtomatik keyingisiga o'tadi |
| 📊 **Analytics** | Har bir javob uchun JSONL log: intent, strategy, provider, latency, success |

## 📦 Texnologiyalar

- **Next.js 14.2** + TypeScript (App Router)
- **Prisma + PostgreSQL** — chat session/history saqlash
- **Mentalaba API** — asosiy ma'lumot manbai (JWT auth, auto-refresh)
- **Groq / OpenRouter / DeepSeek / Gemini** — LLM provider'lar

## 🛠 Tez boshlash

```bash
npm install
cp .env.example .env   # → .env ga barcha key'larni kiriting
npx prisma db push     # PostgreSQL sxemani yaratadi
npm run dev            # http://localhost:3000
```

### 🔑 `.env` — muhim o'zgaruvchilar

```env
# Mentalaba API (majburiy — ma'lumot manbai)
MENTALABA_API_KEY=       # access token (qo'llanma/15_TOKEN_YANGILASH.md ga qarang)
MENTALABA_REFRESH_TOKEN= # refresh token (avtomatik yangilash uchun)
MENTALABA_API_URL=https://api.mentalaba.uz/v1

# AI provider'lar (kamida bittasi; tartib: Groq → OpenRouter → DeepSeek → Gemini)
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
OPENROUTER_API_KEY=      # sk-or-v1-...
OPENROUTER_MODEL=openai/gpt-4o-mini
DEEPSEEK_API_KEY=        # sk-...
DEEPSEEK_MODEL=deepseek-v4-flash
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

# AI'ni o'chirib template rejimda ishlatish (test uchun)
# AI_MODE=template

# Analytics (ixtiyoriy)
# ANALYTICS_FILE=./logs/analytics.ndjson

# Port (standart 3000)
PORT=3000
```

## 🔐 Mentalaba Auth (user login + GUEST rejim) — 2026-08

AI chat endi **mentalaba.uz auth tizimi** bilan birlashtirildi:

```
mentalaba.uz/auth?sign-in  →  login  →  AI chat
```

- User mentalaba.uz saytida login qiladi, **alohida AI login yo'q**
- Frontend token'ni `Authorization: Bearer <token>` header orqali chat API'ga yuboradi
- **Har user o'z tokeni** bilan Mentalaba API'ga murojaat qiladi (global .env tokeni EMAS)
- Token muddati o'tsa — `/v1/auth/refresh` orqali **avtomatik yangilanadi** (DB'da saqlanadi)
- **Suhbatlar izolyatsiya qilingan** — har user faqat o'z session'larini ko'radi (`WHERE user_id = ...`)
- Frontenddan kelgan `userId` ga ishonilmaydi — user id **token'dan** aniqlanadi

### 🧑‍💻 GUEST REJIM (login qilmasdan ishlatish)

Login qilmagan foydalanuvchi ham AI'ni bemalol ishlatadi — **401 qo'yilmaydi**:

- Brauzer `mentalaba_guest_id` (UUID) yaratadi va `X-Guest-Id` header'ida yuboradi
- Guest session'lari shu id bo'yicha izolyatsiya qilinadi (`WHERE guest_id = ...`)
- **Guest tarixi saqlanmaydi** — ro'yxatda ko'rinmaydi, lekin joriy suhbat brauzerda davom etadi (refresh'da tiklanadi)
- **Login qilganda guest session user'ga ulanadi** — shu paytdan boshlab tarix accountingizda saqlanadi

### Frontend token qanday topiladi?

1. **URL parametr**: `?token=...&refreshToken=...` (mentalaba.uz redirect qilganda)
2. **localStorage**: `accessToken` / `token` / `mentalaba_access_token` va boshqa kalitlar

### 🛡️ TOOL ACCESS POLICY (guest vs login)

Guest'lar **Mentalaba API'ga umuman chiqmaydi** — login qilganda data ochiladi:

| So'rov turi | GUEST | LOGIN user |
|---|---|---|
| Suhbat, maslahat, greeting, savol | ✅ | ✅ |
| Yo'nalishlar katalogi (statik) | ✅ | ✅ |
| Maslahat dialogi (3 savol) | ✅ (API'siz) | ✅ |
| Universitet / grant / kontrakt / yangilik / taqqoslash | 🔐 LOGIN so'raladi | ✅ |
| Real ma'lumot (API) | ❌ bloklanadi | ✅ |

- Guest data so'rasa: **"Bu ma'lumotni ko'rish uchun Mentalaba accountiga kiring"** + `[Kirish]` tugmasi
- **401 ≠ ma'lumot yo'q**: token eskirgan/refresh ishlamagan bo'lsa (AUTH_EXPIRED) ham login so'raladi, "topilmadi" deyilmaydi
- Guest javoblari cache'dan ham o'qilmaydi (login qilgan userning data javobi guest'ga chiqib ketmasligi uchun)
- Guest uchun **global .env tokeni ishlatilmaydi** (faqat login qilgan user'ning o'z tokeni)
- Guest'lar uchun LLM entity extraction ham chaqirilmaydi (token tejaladi)

### 🧹 GUEST MA'LUMOTLARNI TOZALASH (TTL)

Guest session'lari suhbat davomiyligi uchun DB'da saqlanadi (tarixda ko'rinmaydi).
Cheksiz o'smasligi uchun eski guest session'lar o'chiriladi:

```bash
npm run cleanup:guests          # 30 kundan eski guest session'lar
GUEST_TTL_DAYS=14 npm run cleanup:guests   # muddatni sozlash
```

Login qilingan user'lar va claim qilingan session'larga tegilmaydi.

### LOKAL TEST

Auth'siz ham chat ishlaydi (guest rejim) — alohida sozlash shart emas. Faqat token'li
foydalanuvchilar uchun validatsiya ishlaydi.
```

## 📋 Nima qilindi (asosiy o'zgarishlar)

1. **Intent Classifier** — 15+ intent, sinonimlar (meditsina→tibbiyot, vrach→tibbiyot), xato yozilgan so'zlarni normalizatsiya, `tavsiya qilingan` kabi o'tgan zamon shakllarini to'g'ri ajratish
2. **Response Strategy** — `template` / `hybrid` / `llm` — oddiy ma'lumot so'rovlarida LLM chaqirilmaydi (token tejaladi)
3. **Follow-up Context Resolver** — `uning narxi?`, `granti bormi?`, `telefoni?` → oxirgi muhokama qilingan universitetga bog'lanadi
4. **Recommendation Engine** — user profile (shahar, yo'nalish, byudjet, grant, yotoqxona) + major-density hard filter + 0–100 scoring
5. **Multi-provider fallback** — Groq limiti tugasa → OpenRouter → DeepSeek → Gemini avtomatik o'tish
6. **Token auto-refresh** — Mentalaba API JWT muddati tugasa refresh token bilan avtomatik yangilash
7. **Conversation Repair** — "Yo'q, men TATUni nazarda tutgandim" → contextni tuzatish
8. **Field-based Response Composer** — "telefoni?" deyilsa faqat telefon, 3 paragraf emas
9. **Analytics** — har javob uchun JSONL log
10. **Formatsiya modullari** — `src/ai-agent/formatter/` (university, direction, tuition, grant, recommendation, comparison)

## ⚠️ Nimaga e'tibor berish kerak

- **`.env` gitga commit qilinmaydi** — .gitignore'da. Har bir yangi muhitda (VPS/Vercel) `.env` ni qayta yaratish kerak.
- **Mentalaba tokenlari muddati o'tadi** — access token ~24 soat, refresh token ~3 kun. Token yangilash uchun `qo'llanma/15_TOKEN_YANGILASH.md` ga qarang yoki `node scripts/mentalaba-login.mjs` ishlating.
- **API key'larni shell'ga export qilmang** — Next.js `.env` dan ustun qo'yadi; eski export qilingan token 401 qaytaradi. `env -u MENTALABA_API_KEY npm run dev` bilan ishga tushiring.
- **AI_MODE=template** — AI o'chirilgan rejim. Test qilganda bu rejimda javoblar template orqali keladi (LLM chaqirilmaydi).
- **Server restart** — `.env` o'zgarishlari va `src/ai-agent/` koddagi o'zgarishlar uchun dev server qayta ishga tushirilishi kerak.
- **Prisma** — `prisma/migrations/` gitignore'da; yangi muhitda `npx prisma db push` qilish kerak.

## 🔄 Nimalarni almashtirish / yangilash kerak

| Narsa | Qachon | Qayerda |
|---|---|---|
| `MENTALABA_API_KEY` | 401 xato chiqsa (har ~24 soat) | `.env` |
| `MENTALABA_REFRESH_TOKEN` | Refresh ham 401 bersa (har ~3 kun) | `.env` |
| `GROQ_API_KEY` | Limit tugasa | `.env` |
| Model nomlari | Provider model eskirsa | `.env` (`*_MODEL`) |
| Major-density threshold'lar | Yangi yo'nalish kategoriyalari qo'shilsa | `src/ai-agent/tool-router.ts` |
| Intent config | Yangi intent qo'shilsa (kodga tegmasdan) | `src/ai-agent/intent-config.json` |
| Formatter shablonlari | Javob uslubi o'zgarsa | `src/ai-agent/formatter/` |

## 🧪 Testlar

```bash
npx tsx scripts/test-intent-synonyms.ts   # 261+ intent/entity regression test
npx tsx scripts/_long-test.mjs            # 23 bosqichli yagona chat ichida long-test
npx tsx scripts/_tier-unit4.ts            # tavsiya / scoring unit testlari
npx tsc --noEmit                          # TypeScript tekshiruvi
```

## 📁 Katalog tuzilishi (asosiy)

```
src/ai-agent/
├── intent-classifier.ts     # Intent + entity aniqlash (rule-based)
├── intent-config.json       # Intent'lar JSON konfiguratsiyasi
├── follow-up-context.ts     # Suhbat konteksti resolver (lastUniversity va h.k.)
├── tool-router.ts           # Tool tanlash + API chaqiruvlar + scoring
├── provider-manager.ts      # LLM provider fallback + template rejim
├── formatter/               # Javob shablonlari (university, direction, ...)
├── request-field.ts         # "telefoni?" → faqat telefon javobi
├── analytics.ts             # JSONL log
└── response-cache.ts        # (ixtiyoriy) cache
```

To'liq hujjatlar: [`qo'llanma/`](qo'llanma/) — API, agent oqimi, deploy va token yangilash bo'yicha.
