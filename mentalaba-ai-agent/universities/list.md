# Universitetlar — Ro'yxat

## Ro'yxat endpointi

```
GET /api/v1/universities
```

## So'rov parametrlari

| Parametr | Tur | Tavsif |
|-----------|------|-------------|
| `search` | string | Nom bo'yicha qidiruv (EN/AM) |
| `region_id` | integer | Viloyat bo'yicha filtrlash |
| `category_id` | integer | Kategoriya bo'yicha filtrlash |
| `type_id` | integer | Muassasa turi bo'yicha filtrlash |
| `has_dormitory` | boolean | Yotoqxona mavjudligi bo'yicha filtrlash |
| `limit` | integer | Sahifadagi elementlar |
| `cursor` | string | Paginatsiya kursori |

## Javob formati

```json
{
  "data": [
    {
      "id": "uni_123",
      "slug": "addis-ababa-university",
      "name": "Addis Ababa University",
      "name_am": "አዲስ አበባ ዩኒቨርሲቲ",
      "region": "Addis Ababa",
      "type": "University",
      "logo_url": "https://...",
      "student_count": 48000,
      "direction_count": 120,
      "has_dormitory": true
    }
  ],
  "pagination": {
    "next_cursor": "...",
    "has_more": true,
    "total": 85
  }
}
```

## Saralash variantlari

| Maydon | Standart | Tavsif |
|--------|----------|-------------|
| `name` | O'sish | Nom bo'yicha alifbo tartibida |
| `student_count` | Kamayish | Talabalar soni bo'yicha |
| `established_year` | Kamayish | Tashkil etilgan sana bo'yicha |
