# Vosita: search_direction

## Tavsif
Mezonlar asosida akademik yo'nalishlar/dasturlarni qidirish.

## Parametrlar

| Parametr | Tur | Majburiy | Tavsif |
|----------|-----|----------|--------|
| `search` | string | Yo'q | Qidiruv so'rovi |
| `category_id` | integer | Yo'q | Kategoriya bo'yicha filtrlash |
| `university_id` | string | Yo'q | Universitet bo'yicha filtrlash |
| `degree_id` | integer | Yo'q | Daraja darajasi bo'yicha filtrlash |
| `education_type_id` | integer | Yo'q | Ta'lim turi bo'yicha filtrlash |
| `language_id` | integer | Yo'q | Til bo'yicha filtrlash |
| `contract_type_id` | integer | Yo'q | Shartnoma turi bo'yicha filtrlash |
| `subject_id` | integer | Yo'q | Kerakli fan bo'yicha filtrlash |
| `limit` | integer | Yo'q | Natijalar chegarasi |

## Chaqiruv misoli

```json
{
  "name": "search_direction",
  "parameters": {
    "search": "computer science",
    "degree_id": 4,
    "language_id": 1
  }
}
```

## Qaytaradi

```json
{
  "results": [
    {
      "id": "dir_001",
      "name": "Computer Science",
      "name_am": "ኮምፒውተር ሳይንስ",
      "category": "Axborot texnologiyalari",
      "degree": "Bakalavr darajasi",
      "duration_years": 4,
      "universities": ["Addis Ababa University", "AAiT"]
    }
  ],
  "total": 15
}
```
