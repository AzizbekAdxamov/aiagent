# Testlash — API Testlari

## Test kategoriyalari

### Autentifikatsiya testlari
- To'g'ri API kaliti → 200
- API kaliti yo'q → 401
- Noto'g'ri API kaliti → 401
- Muddati o'tgan API kaliti → 401

### CRUD testlari
- GET ro'yxat → 200 + paginatsiyalangan natijalar
- GET tafsilot → 200 + to'liq ob'ekt
- GET mavjud bo'lmagan → 404
- POST yaratish → 201 + tekshirish
- POST noto'g'ri ma'lumot → 422

### Qidiruv testlari
- Asosiy qidiruv natijalarni qaytaradi
- Filtrlangan qidiruv to'g'ri ishlaydi
- Birlashtirilgan filtrlar ishlaydi
- Bo'sh qidiruv bo'sh natijalarni qaytaradi
- Paginatsiya kursori ishlaydi
- Saralash tartibi to'g'ri

### Chat testlari
- POST /chat xabar bilan → 200
- To'g'ri intentsiya marshrutlash
- Vosita bajarilishi ma'lumotlarni qaytaradi
- Bo'sh tarix boshqariladi
- Sessiya konteksti saqlanadi

### Tezlik cheklash testlari
- Limit ostida → 200
- Limitdan oshib ketdi → 429
- Sovutishdan keyin qayta tiklash

## Test tuzilishi

```
tests/
  api/
    auth.test.ts
    universities.test.ts
    directions.test.ts
    grants.test.ts
    news.test.ts
    chat.test.ts
    rateLimit.test.ts
  unit/
    services.test.ts
    tools.test.ts
    router.test.ts
```

## Vositalar

- **Framework**: Jest yoki Vitest
- **HTTP**: Supertest
- **Mock**: MSW (Mock Service Worker)
- **Qamrov**: ≥ 80% qamrov maqsadi
