# Yo'nalishlar — To'lov

## Umumiy ma'lumot

To'lov miqdorlari yo'nalish, shartnoma turi va universitetga qarab farqlanadi. To'lov moduli to'lov tuzilmalarini boshqaradi.

## Ma'lumot modeli

```typescript
interface DirectionTuition {
  direction_id: string;
  university_id: string;
  contract_type_id: number;
  amount: number;
  currency: string;    // standart: ETB
  per_year: boolean;   // true = yillik, false = jami
  notes: string;
  notes_am: string;
}
```

## To'lov turlari

| Shartnoma turi | Odatdagi narx |
|----------------|---------------|
| Davlat (bepul) | 0 ETB |
| Davlat (to'lovli) | 15,000 - 80,000 ETB/yil |
| Xususiy | 30,000 - 200,000 ETB/yil |

## AI Agent bilan muloqot

- "AAUda kompyuter fanlari uchun to'lov qancha?"
- "Muhandislik uchun to'lovli variantlar qanday?"
- "Menga 50,000 ETB dan arzon yo'nalishlarni ko'rsat"
