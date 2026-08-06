# Vosita: search_university

## Tavsif
Turli mezonlar asosida universitetlarni qidirish.

## Parametrlar

| Parametr | Tur | Majburiy | Tavsif |
|----------|-----|----------|--------|
| `search` | string | Yo'q | Qidiruv so'rovi (nom, joylashuv) |
| `region_id` | integer | Yo'q | Viloyat bo'yicha filtrlash |
| `category_id` | integer | Yo'q | Muassasa kategoriyasi bo'yicha filtrlash |
| `type_id` | integer | Yo'q | Muassasa turi bo'yicha filtrlash |
| `has_dormitory` | boolean | Yo'q | Yotoqxona mavjudligi bo'yicha filtrlash |
| `limit` | integer | Yo'q | Natijalar chegarasi (standart: 10) |

## Chaqiruv misoli

```json
{
  "name": "search_university",
  "parameters": {
    "search": "addis ababa",
    "limit": 5
  }
}
```

## Qaytaradi

```json
{
  "results": [
    {
      "id": "uni_123",
      "name": "Addis Ababa University",
      "name_am": "አዲስ አበባ ዩኒቨርሲቲ",
      "region": "Addis Ababa",
      "student_count": 48000
    }
  ],
  "total": 3
}
```
