# MENTALABA API Token'larini Yangilash Qo'llanmasi

> **Muammo belgisi:** server logida `[Token Refresh Failed] 401` chiqadi va chat javoblari "ma'lumotlar bazasiga bog'lanishda xatolik" deb qaytadi.
> **Sabab:** `.env` dagi token'lar muddati o'tgan yoki revoke qilingan.
> **Yechim:** quyida — yangi token olishning 3 ta usuli.

---

## 1. Token tizimi qanday ishlaydi

Mentalaba agenti barcha ma'lumotni **Mentalaba API** orqali oladi (hech qachon DB bilan to'g'ridan-to'g'ri ishlamaydi):

| O'zgaruvchi | Vazifasi |
|---|---|
| `MENTALABA_API_KEY` | **Access token** (bearer JWT) — har bir so'rovda `Authorization: Bearer <token>` header'ida yuboriladi |
| `MENTALABA_REFRESH_TOKEN` | **Refresh token** — access token eskirganda yangisini olish uchun |
| `MENTALABA_API_URL` | API bazaviy manzili (default: `https://api.mentalaba.uz/v1`) |

**Avtomatik oqim** (`src/lib/external-api.ts`):
1. Har so'rovda access token yuboriladi.
2. Server `401` qaytarsa → avtomatik `POST /v1/auth/refresh` chaqiriladi (`{ refreshToken }` body bilan).
3. Refresh muvaffaqiyatli bo'lsa → yangi token bilan so'rov qayta yuboriladi.
4. Har **22 soatda** bir marta tokenni rejalashtirilgan yangilash ham bor.

**Nega `401` chiqyapti?** Refresh token'ning o'zi ham JWT — uning ham muddati bor. Refresh token muddati o'tsa, `POST /v1/auth/refresh` ham `401` qaytaradi (bizning hozirgi holat). Bunday holda **yana login qilib yangi refresh token olish kerak** — avtomatik tuzalmaydi.

> ⚠️ **Muhim:** yangi token'lar yangi login orqali olinadi. `MENTALABA_API_KEY` va `MENTALABA_REFRESH_TOKEN` — **ikkalasi ham** yangilanishi kerak (faqat bittasi emas).

---

## 2. Yangi token olish usullari

### ✅ Usul A: Swagger orqali (eng oson, kod kerak emas)

1. **Swagger'ni oching:** https://api.mentalaba.uz/docs
2. **Auth** bo'limidan login endpoint'ini toping:
   - `POST /v1/auth/super-admin/login` — super admin (tavsiya etiladi)
   - `POST /v1/auth/admin/login` — admin
3. **Try it out** tugmasini bosing.
4. Body'ga email va parol kiriting (boshqaruv panelidagi akkauntingiz):
   ```json
   {
     "email": "sizning@email.uz",
     "password": "parolingiz"
   }
   ```
5. **Execute** tugmasini bosing.
6. Javobda (`Response body`) quyidagi field'larni qidiring:
   ```json
   {
     "accessToken": "eyJhbGciOi...",      // yoki "access_token" / "token"
     "refreshToken": "eyJhbGciOi..."
   }
   ```
   *(Kod ikkala formatni ham — camelCase va snake_case — tushunadi.)*
7. Shularni `.env` ga yozing (3-bo'lim).

> 💡 Agent ishlatadigan refresh endpoint `AuthController_adminRefreshToken` — ya'ni token'lar **admin rolidan** olinishi kerak. Oddiy foydalanuvchi login'i (`POST /v1/auth/user/login`, phone+password) barcha endpoint'larga kira olmasligi mumkin.

### ✅ Usul B: Brauzer DevTools orqali (mentalaba.uz sayti)

Agar boshqaruv paneliga brauzer orqali kirsangiz:

1. **mentalaba.uz** saytiga admin sifatida kiring.
2. `F12` → **Network** (Tarmoq) bo'limini oching.
3. Sahifani yangilang (F5) va `universities` kabi API so'rovini toping.
4. So'rov ustiga bosing → **Request Headers** bo'limida:
   ```
   Authorization: Bearer eyJhbGciOi...
   ```
   — mana shu `eyJ...` qismi **access token** (`MENTALABA_API_KEY`).
5. **Refresh token** uchun:
   - Login so'rovining (masalan `POST /auth/super-admin/login`) **Response** bo'limida `refreshToken` ni qidiring; yoki
   - **Application** → **Local Storage** → mentalaba.uz domain'i ostida `refreshToken`/`accessToken` kalitlarini qidiring.

### ✅ Usul C: Auth Key orqali (sayt login kaliti)

Agar sayt tomonidan berilgan `auth_key` bo'lsa:

```
GET https://api.mentalaba.uz/v1/auth/user/login?auth_key=KEY
```

— saytga redirect bo'lib, auth key orqali login amalga oshadi va token'lar qaytadi.

---

## 3. `.env` faylini yangilash

Proyekt ildizidagi **`.env`** faylini oching:

```bash
# Eski qiymatlar o'rniga yangilarini yozing
MENTALABA_API_KEY=eyJhbGciOi...   # access token
MENTALABA_REFRESH_TOKEN=eyJhbGciOi...   # refresh token
```

> ⚠️ **Server'ni qayta ishga tushirish shart!** Next.js `.env` qiymatlarini **server ishga tushganda** o'qiydi — faylni o'zgartirgandan keyin avtomatik yangilanmaydi. Dev server: `Ctrl+C` → `npm run dev`.

---

## 4. Token'lar ishlayotganini tekshirish

### Tezkor curl tekshiruvi

```bash
curl -s https://api.mentalaba.uz/v1/universities/filter?limit=1 \
  -H "Authorization: Bearer $MENTALABA_API_KEY" \
  -H "Content-Type: application/json"
```

- **200** + JSON ma'lumot → token ishlayapti ✅
- **401** → token hali ham yaroqsiz (qayta login qiling)
- **200 + `[]`** → token to'g'ri, lekin shartga mos ma'lumot yo'q (bu ham normal)

### Agent'ni to'liq tekshirish

Serverni qayta ishga tushirib, chat so'rovini yuboring:

```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Toshkentdagi xususiy tibbiyot universitetlari","language":"uz"}'
```

Server logida endi `[Token Refresh Failed]` **bo'lmasligi** kerak — o'rniga real ma'lumot qaytishi kerak.

---

## 5. Tez-tez uchraydigan muammolar

| Alomat | Sabab | Yechim |
|---|---|---|
| `[Token Refresh Failed] 401` | Refresh token ham eskirgan | Yana login qilib ikkala tokenni yangilang |
| `.env` o'zgartirdim, lekin o'zgarmadi | Next.js env'ni ishga tushishda o'qiydi | Server'ni to'liq qayta ishga tushiring |
| `403 Forbidden` | Token to'g'ri, lekin ruxsat yo'q (user rolida) | **Admin/super-admin** login'idan token oling |
| Javob `[]` bo'sh array | Token OK, filter'ga mos ma'lumot yo'q | Boshqa parametr bilan sinab ko'ring |
| Token ertaga yana ishlamayapti | Access token muddati qisqa | Normal — 22 soatlik avto-refresh tizimi ishlashi kerak; refresh token o'zi ham eskirsa yuqoridagi usulni takrorlang |

---

## 6. Xavfsizlik eslatmalari

- 🔒 **`.env` hech qachon git'ga qo'shilmasin.** Hozirgi `.gitignore` faqat `.env*.local` ni yashiradi — `.env` ni ham qo'shish tavsiya etiladi:
  ```bash
  echo ".env" >> .gitignore
  ```
- 🔑 Token'lar kimgadir ko'rinmasin — ular bilan har kim API'da siz nomingizdan ishlay oladi.
- 📝 Token'lar sekundlar ichida eskirishi mumkin (masalan, parol o'zgartirilsa yoki xavfsizlik tufayli revoke qilinsa) — shunda shu qo'llanmadagi login qadamini qaytaring.

---

## 7. Foydali havolalar

| Nima | Manzil |
|---|---|
| Swagger (barcha endpoint'lar) | https://api.mentalaba.uz/docs |
| API bazaviy URL | https://api.mentalaba.uz/v1 |
| Agent kodidagi auth logikasi | `src/lib/external-api.ts` |
| Diagnostika script | `scripts/inspect-upstream.ts` |
