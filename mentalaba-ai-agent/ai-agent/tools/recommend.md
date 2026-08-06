# Vosita: recommend

## Tavsif
Foydalanuvchi uchun shaxsiylashtirilgan tavsiyalar yaratish.

## Parametrlar

| Parametr | Tur | Majburiy | Tavsif |
|----------|-----|----------|--------|
| `preferences` | object | Yo'q | Foydalanuvchi afzalliklari |
| `preferences.region_id` | integer | Yo'q | Afzal viloyat |
| `preferences.degree_id` | integer | Yo'q | Afzal daraja darajasi |
| `preferences.category_id` | integer | Yo'q | Afzal kategoriya |
| `preferences.budget_max` | number | Yo'q | Maksimal to'lov byudjeti |
| `preferences.language_id` | integer | Yo'q | Afzal til |
| `preferences.education_type_id` | integer | Yo'q | Afzal o'qish usuli |

## Chaqiruv misoli

```json
{
  "name": "recommend",
  "parameters": {
    "preferences": {
      "region_id": 1,
      "degree_id": 4,
      "budget_max": 50000,
      "language_id": 1,
      "education_type_id": 1
    }
  }
}
```

## Qaytaradi

```json
{
  "universities": [...],
  "directions": [...],
  "grants": [...],
  "reasoning": "Addis Ababaga bo'lgan afzalligingiz asosida..."
}
```

---

# Vosita: navigation

## Tavsif
Platforma ichida navigatsiya harakatlarini boshqarish.

## Parametrlar

| Parametr | Tur | Majburiy | Tavsif |
|----------|-----|----------|--------|
| `action` | string | Ha | Navigatsiya harakati |
| `target` | string | Ha | Maqsadli sahifa/ob'ekt |

## Harakatlar

| Harakat | Tavsif |
|---------|--------|
| `view_university` | Universitet tafsilotiga o'tish |
| `view_direction` | Yo'nalish tafsilotiga o'tish |
| `view_grant` | Grant tafsilotiga o'tish |
| `view_news` | Yangilik maqolasiga o'tish |
| `view_all_universities` | Universitetlar ro'yxatiga o'tish |
| `view_all_directions` | Yo'nalishlar ro'yxatiga o'tish |
| `view_all_grants` | Grantlar ro'yxatiga o'tish |
| `view_all_news` | Yangiliklar ro'yxatiga o'tish |
| `share` | Joriy elementni ulashish |
| `save` | Elementni saqlash/xatcho'p |
