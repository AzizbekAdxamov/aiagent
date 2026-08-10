# 🌐 Deploy — frontend/backend alohida (2026-08)

2026-08 dan boshlab loyiha **2 ta alohida repo** va **2 ta Vercel loyihasiga**
bo'lingan:

| Qism | Repo | Vercel loyihasi | Nima ishlaydi |
|---|---|---|---|
| **Backend (API + AI agent)** | `AzizbekAdxamov/aiagent` | `aiagent` (mavjud) | `/api/v1/*` — chat, universities, directions... |
| **Frontend (chat UI)** | `AzizbekAdxamov/ai_front` | yangi loyiha | sahifa — `http://localhost:3001` (dev) |

Frontend backend'ga `NEXT_PUBLIC_API_URL` orqali ulanadi; backend `CORS`
orqali frontend domeniga ruxsat beradi.

---

## 1-qadam: Backend'ni deploy qilish (aiagent — allaqachon tayyor)

`aiagent` repo'da commit qilinsa Vercel avtomatik redeploy qiladi.

**Vercel → aiagent → Settings → Environment Variables:**

```env
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require   # Neon/Postgres
MENTALABA_API_KEY=...
MENTALABA_REFRESH_TOKEN=...
GROQ_API_KEY=...
GEMINI_API_KEY=...
# frontend domenlari (vergul bilan) — PRODUCTION'da majburiy:
CORS_ALLOWED_ORIGINS=https://ai-front-xxx.vercel.app,https://ai.mentalaba.uz
```

> ⚠️ **CORS_ALLOWED_ORIGINS** — frontend Vercel URL'ini yozmasangiz, brauzerda
> CORS bloki chiqadi (API server'da ishlayveradi, lekin frontend javobni
> o'qiy olmaydi).

---

## 2-qadam: Frontend'ni deploy qilish (ai_front — yangi Vercel loyihasi)

1. [vercel.com](https://vercel.com) → **Add New → Project**
2. `AzizbekAdxamov/ai_front` repo'sini import qiling
3. **Environment Variables:**
   ```env
   NEXT_PUBLIC_API_URL=https://<backend-vercel-url>   # masalan https://aiagent.vercel.app
   ```
4. **Deploy** — frontend avtomatik backend'ga ulanadi.

---

## 3-qadam: `ai.mentalaba.uz` subdomeni (ixtiyoriy, brand uchun)

Endi subdomen **frontend loyihasiga** ulanadi (ilgari monolitga ulangan edi):

1. Vercel → **ai_front loyihasi → Settings → Domains** → `ai.mentalaba.uz` Add
2. DNS provayderida (UZINFO/Cloudflare/namecheap):

   | Type | Name | Value | TTL |
   |---|---|---|---|
   | CNAME | `ai` | `cname.vercel-dns.com` | Auto (300) |

3. Vercel'da **Valid Configuration** paydo bo'lishini kuting (10 daq – 24 soat)
4. Frontend env'larini yangilang (agar `ai.mentalaba.uz` dan chaqirilsa):
   ```
   NEXT_PUBLIC_API_URL=https://aiagent.vercel.app    # backend — o'zgarmaydi
   ```
5. Backend'da `CORS_ALLOWED_ORIGINS` ga `https://ai.mentalaba.uz` qo'shildimi — tekshiring.

---

## 🔄 Login oqimi (o'zgarishsiz ishlaydi)

```
mentalaba.uz/auth?sign-in  →  login  →  ai.mentalaba.uz/?token=...&refreshToken=...
                                              ↓
                                        chat-store resolveAuthTokens()
                                        token localStorage'ga saqlanadi
```

- Frontend kodida domen yozilmagan — `NEXT_PUBLIC_API_URL` dan backend topiladi
- `?token=&refreshToken=` parametrlari orqali login token qabul qilinadi
- Guest rejim ham ishlayveradi

---

## 🧪 Local ishga tushirish

```bash
# Terminal 1 — backend (aiagent repo, port 3000)
npm install && cp .env.example .env && npx prisma db push && npm run dev

# Terminal 2 — frontend (ai_front repo, port 3001)
npm install && cp .env.example .env && npm run dev
# → http://localhost:3001 (frontend) → http://localhost:3000/api/v1 (backend)
```

---

## ⚠️ Muhim eslatmalar

- **CORS** — yangi frontend domeni qo'shilsa, backend'da `CORS_ALLOWED_ORIGINS`
  ga qo'shish shart (aks holda brauzer bloklaydi).
- **Backend root sahifasi yo'q** — `/api/*` route'lar ishlaydi, `/` da 404.
- **Mentalaba.uz asosiy saytidagi** "AI chat" tugmasi
  `https://ai.mentalaba.uz` (yoki frontend URL) ga yo'naltiriladi.
- Token muddati o'tsa — `qo'llanma/15_TOKEN_YANGILASH.md` ga qarang.
