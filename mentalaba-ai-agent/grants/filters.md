# Grantlar — Filtrlar

## Mavjud filtrlar

| Filtr | Tur | Tavsif |
|--------|------|-------------|
| `search` | string | Nomi yoki provayderi bo'yicha qidirish |
| `type` | string | Grant turi: full, partial, tuition_only, living_expenses |
| `university_id` | string | Universitet bo'yicha filtrlash |
| `direction_id` | string | Yo'nalish bo'yicha filtrlash |
| `amount_min` | number | Minimal miqdor |
| `amount_max` | number | Maksimal miqdor |
| `deadline_before` | date | Muddati bo'yicha filtrlash (sana oldin) |
| `deadline_after` | date | Muddati bo'yicha filtrlash (sana keyin) |
| `is_active` | boolean | Faqat faol grantlar |

## Misol

```
GET /api/v1/grants?type=full&is_active=true&deadline_after=2026-06-01
```

2026-yil iyunidan keyin muddati bo'lgan faol to'liq stipendiyalarni qaytaradi.

## AI Agent filtrlash

- "Menga faol to'liq stipendiyalarni ko'rsat" → `type=full, is_active=true`
- "Shu oyda muddati tugaydigan grantlar" → `deadline_before=2026-08-31, deadline_after=2026-08-01`
- "100k dan past stipendiyalar" → `amount_max=100000`
