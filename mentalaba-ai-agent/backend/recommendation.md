# Backend — Tavsiya Xizmati

## Maqsad

Foydalanuvchi afzalliklari va ma'lumotlari asosida shaxsiylashtirilgan tavsiyalar yaratadi.

## Tavsiya tizimi

```
Foydalanuvchi afzalliklari
    │
    ▼
┌──────────────────┐
│ Xususiyatlarni   │
│ ajratib olish    │
│ - Joylashuv      │
│ - Byudjet        │
│ - Fanlar         │
│ - Daraja darajasi│
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Ball berish      │
│ mexanizmi        │
│ - Universitet    │
│ - Yo'nalish      │
│ - Grant          │
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Reyting & Filtr  │
│ - Eng yaxshi N   │
│ - Xilma-xillik   │
│ - Muvofiqlik     │
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Javobni yig'ish  │
│ - Tushuntirish   │
│ - Kartalar       │
│ - Keyingi qadam  │
└──────────────────┘
```

## Ball berish og'irliklari

| Kategoriya | Og'irliklar |
|------------|-------------|
| Universitetlar | Joylashuv: 25%, Akademik: 20%, Obro': 15%, Imkoniyat: 20%, Imkoniyatlar: 10%, Til: 10% |
| Yo'nalishlar | Fan Mosligi: 30%, Karyera: 25%, Qiziqish: 20%, Foydalanish: 15%, Davomiylik: 10% |
| Grantlar | Muvofiqlik: 30%, Tur: 25%, Muddati: 20%, Miqdor: 15%, Aloqadorlik: 10% |

## Javob formati

```json
{
  "universities": [...],
  "directions": [...],
  "grants": [...],
  "reasoning": "Sizning afzalliklaringiz asosida...",
  "next_steps": [...]
}
```
