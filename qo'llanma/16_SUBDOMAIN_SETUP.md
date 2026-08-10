# 🌐 AI Chat'ni `ai.mentalaba.uz` subdomeniga ulash

AI chat hozir `aiagent-sand.vercel.app` (Vercel'ning random domeni) da turibdi.
Mentalaba.uz bilan bir xil ko'rinishi va login to'g'ri ishlashi uchun chat'ni
`ai.mentalaba.uz` subdomeniga ko'chiramiz.

> **Nima uchun kerak?**
> - `mentalaba.uz/auth?sign-in` da login qilingach, token `ai.mentalaba.uz`'ga qaytadi
>   (bir xil domen oilasi → cookie/localStorage to'g'ri ishlaydi)
> - Brauzerda `aiagent-sand.vercel.app` emas, `ai.mentalaba.uz` ko'rinadi (brand)
> - Vercel'ning random domeni doimiy emas, custom domen barqaror

---

## 1-qadam: Vercel dashboard'da domen qo'shish

1. [vercel.com](https://vercel.com) ga kiring
2. **aiagent** loyihasini oching (AI chat deploy qilingan loyiha)
3. **Settings → Domains** bo'limiga o'ting
4. Maydonga `ai.mentalaba.uz` yozib, **Add** tugmasini bosing

Vercel sizga DNS yozuvini ko'rsatadi, masalan:

```
Type:  CNAME
Name:  ai
Value: cname.vercel-dns.com
```

*(Yoki A record — Vercel aniq qiymatni ko'rsatadi, shuni ishlating.)*

---

## 2-qadam: DNS provayderida yozuv qo'shish

`mentalaba.uz` domenining DNS boshqaruvi qayerda bo'lsa (UZINFO, Cloudflare,
namecheap, va h.k.) — o'sha panelda CNAME yozuvi qo'shing:

| Type | Name | Value | TTL |
|---|---|---|---|
| CNAME | `ai` | `cname.vercel-dns.com` | Auto (300) |

> DNS yozuvi **10 daqiqadan 24 soatgacha** tarqalishi mumkin.

---

## 3-qadam: Vercel'da tasdiqlash

DNS yozuvi qo'shilgach, Vercel dashboard'idagi Domains sahifasida
`ai.mentalaba.uz` yonida **Valid Configuration** ko'rinadi (avtomatik tekshiradi).
Bir necha daqiqada domen ishlay boshlaydi.

---

## 4-qadam: Environment o'zgaruvchilarni to'g'rilash (Vercel)

Vercel loyihasida **Settings → Environment Variables** bo'limida:

```
NEXT_PUBLIC_APP_URL = https://ai.mentalaba.uz
NEXT_PUBLIC_API_URL = https://ai.mentalaba.uz/api/v1
```

> Bu o'zgaruvchilar kodda hozircha ishlatilmaydi, lekin kelajakda kerak bo'ladi.
> Production environment uchun o'rnating, keyin **Redeploy** bosing.

---

## 5-qadam: Redeploy + tekshirish

1. Vercel'da **Deployments → Redeploy** tugmasini bosing (yangi env'lar uchun)
2. `https://ai.mentalaba.uz` ni brauzerda oching — chat ochilishi kerak
3. `aiagent-sand.vercel.app` hali ham ishlaydi (eski domen) — ikkalasi ham
   xuddi shu deploy'ni ko'rsatadi

---

## 🔄 Login oqimi (avtomatik ishlaydi)

```
mentalaba.uz/auth?sign-in  →  login  →  ai.mentalaba.uz/?token=...&refreshToken=...
                                              ↓
                                        chat-store resolveAuthTokens()
                                        token localStorage'ga saqlanadi
```

- Chat kodida hech qanday domen yozilmagan — hamma narsa avtomatik
- `?token=&refreshToken=` parametrlari orqali login qilingan token qabul qilinadi
- Guest rejim ham ishlayveradi (login qilmaganlar ham chatni ko'radi)

---

## ⚠️ Muhim eslatmalar

- **DNS'ni o'chirmang** — `aiagent-sand.vercel.app` eski domen qoladi, lekin
  asosiy foydalanuvchi `ai.mentalaba.uz` dan kiradi
- **Mentalaba.uz asosiy saytida** (ayrim loyiha) "AI chat" tugmasini
  `https://ai.mentalaba.uz` ga yo'naltirish kerak bo'lishi mumkin
- Token muddati o'tsa — `qo'llanma/15_TOKEN_YANGILASH.md` ga qarang
