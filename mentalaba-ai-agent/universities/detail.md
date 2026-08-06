# Universitetlar — Batafsil

## Batafsil endpointi

```
GET /api/v1/universities/:id
GET /api/v1/universities/:slug  (slug asosida qidiruv)
```

## Javob formati

```json
{
  "data": {
    "id": "uni_123",
    "slug": "addis-ababa-university",
    "name": "Addis Ababa University",
    "name_am": "አዲስ አበባ ዩኒቨርሲቲ",
    "region": {
      "id": 1,
      "name": "Addis Ababa",
      "name_am": "አዲስ አበባ"
    },
    "type": "University",
    "category": "Public University",
    "established_year": 1950,
    "website": "https://www.aau.edu.et",
    "description": "Addis Ababa University...",
    "description_am": "አዲስ አበባ ዩኒቨርሲቲ...",
    "address": "Addis Ababa, Ethiopia",
    "phone": "+251-111-234567",
    "email": "info@aau.edu.et",
    "logo_url": "https://...",
    "cover_image_url": "https://...",
    "student_count": 48000,
    "has_dormitory": true,
    "has_library": true,
    "has_lab": true,
    "stats": {
      "direction_count": 120,
      "grant_count": 15,
      "gallery_count": 24
    }
  }
}
```

## Tegishli ob'ektlar

Batafsil ko'rinish tegishli hisoblarni o'z ichiga oladi. To'liq tegishli ma'lumotlar quyi endpointlar orqali mavjud:

- `GET /api/v1/universities/:id/directions`
- `GET /api/v1/universities/:id/grants`
- `GET /api/v1/universities/:id/gallery`
