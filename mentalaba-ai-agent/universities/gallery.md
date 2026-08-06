# Universitetlar — Galereya

## Galereya endpointi

```
GET /api/v1/universities/:id/gallery
```

## Javob formati

```json
{
  "data": [
    {
      "id": "gal_001",
      "url": "https://.../campus_aerial.jpg",
      "alt": "Asosiy kampusning havodan ko'rinishi",
      "alt_am": "የዋናው ግቢ አየር ላይ እይታ",
      "caption": "Asosiy kampus - Havodan ko'rinish",
      "caption_am": "ዋና ግቢ - አየር ላይ እይታ",
      "type": "image",
      "is_primary": false,
      "order": 1
    }
  ]
}
```

## Rasm turlari

- campus_view — Kampus va bino fotosuratlari
- classroom — Darsxona va laboratoriya fotosuratlari
- library — Kutubxona jihozlari
- dormitory — Yotoqxona fotosuratlari
- sports — Sport inshootlari
- event — Kampus tadbirlari fotosuratlari
- logo — Universitet logotipi
- cover — Muqova/hero rasm

## Saqlash

Rasmlar tez yuklash uchun CDN tarqatish bilan bulutli saqlashda (AWS S3 yoki shunga o'xshash) saqlanadi.
