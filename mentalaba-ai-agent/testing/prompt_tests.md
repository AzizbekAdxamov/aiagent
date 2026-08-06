# Testlash — Prompt Testlari

## Maqsad

AI promptlari turli stsenariylar uchun kutilgan natijalarni ishlab chiqarishini tekshirish.

## Test kategoriyalari

### Intentsiyani tasniflash testlari

| Kirish | Kutilgan intentsiya | Min ishonch |
|-------|---------------------|-------------|
| "Menga Addis Ababadagi universitetlarni ko'rsat" | university_search | 0.8 |
| "Kompyuter fanlari dasturlarini toping" | direction_search | 0.8 |
| "Qanday stipendiyalar mavjud?" | grant_search | 0.8 |
| "AAU va BDU ni taqqoslang" | comparison | 0.8 |
| "Qabul talablari qanday?" | admission | 0.8 |
| "Kreditlarimni o'tkaza olamanmi?" | transfer | 0.8 |
| "Efiopiya ta'limi haqida aytib bering" | faq | 0.7 |

### Javob sifati testlari

| Test | Mezon |
|------|--------|
| Javob formati | To'g'ri karta tuzilishini qaytaradi |
| Aloqadorlik | Javob so'rov bilan bog'liq |
| To'liqlik | Barcha so'ralgan ma'lumot berilgan |
| Til | So'ralgan tilni to'g'ri ishlatadi (EN/UZ) |
| Kuzatuvlar | Tegishli keyingi harakatlarni taklif qiladi |

### Chegara holati testlari

- Noaniq so'rovlar → aniqlashtirish
- Haqorat → muloyim qayta yo'naltirish
- Bo'sh so'rov → salomlashish/yordam
- Juda uzun so'rov → xatosiz boshqaradi
- Aralash til so'rovi → asosiy intentsiyani aniqlaydi

## Test vositasi

```typescript
interface PromptTest {
  input: string;
  expectedIntent: string;
  minConfidence: number;
  expectedTools?: string[];
  avoidTools?: string[];
  requiredKeywords?: string[];
}
```

## Avtomatlashtirish

- Har bir prompt o'zgarishida prompt testlarini ishga tushirish
- Regressiya hisobotlarini yaratish
- Intentsiyani tasniflash aniqligini kuzatish
- Javob sifat ko'rsatkichlarini monitoring qilish
