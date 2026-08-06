# Vosita: search_grants

## Tavsif
Mezonlar asosida grantlar va stipendiyalarni qidirish.

## Parametrlar

| Parametr | Tur | Majburiy | Tavsif |
|----------|-----|----------|--------|
| `search` | string | Yo'q | Qidiruv so'rovi |
| `type` | string | Yo'q | Grant turi (full, partial va boshqalar) |
| `university_id` | string | Yo'q | Universitet bo'yicha filtrlash |
| `direction_id` | string | Yo'q | Yo'nalish bo'yicha filtrlash |
| `deadline_before` | string | Yo'q | Muddati bo'yicha filtrlash (ISO sana) |
| `is_active` | boolean | Yo'q | Faqat faol grantlar |
| `limit` | integer | Yo'q | Natijalar chegarasi |

## Chaqiruv misoli

```json
{
  "name": "search_grants",
  "parameters": {
    "type": "full",
    "is_active": true
  }
}
```

## Qaytaradi

```json
{
  "results": [
    {
      "id": "grant_001",
      "title": "AAU Merit Scholarship",
      "title_am": "አአዩ የብቃት ስኮላርሺፕ",
      "type": "full",
      "provider": "Addis Ababa University",
      "application_deadline": "2026-09-15",
      "description": "..."
    }
  ],
  "total": 5
}
```
