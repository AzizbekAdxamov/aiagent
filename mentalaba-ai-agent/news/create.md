# Yangiliklar — Yaratish

## Yaratish endpointi

```
POST /api/v1/news
```

## So'rov tanasi

```json
{
  "title": "2026 yil uchun yangi stipendiya dasturi e'lon qilindi",
  "title_am": "ለ2026 አዲስ የስኮላርሺፕ ፕሮግራም ይፋ ሆነ",
  "excerpt": "Ta'lim vazirligi e'lon qiladi...",
  "excerpt_am": "የትምህርት ሚኒስቴር ይፋ አደረገ...",
  "content": "To'liq maqola mazmuni bu yerda...",
  "content_am": "ሙሉ የዜና ይዘት እዚህ...",
  "cover_image_url": "https://.../news_cover.jpg",
  "author": "Mentalaba Team",
  "related_university_ids": ["uni_001", "uni_005"],
  "related_direction_ids": [],
  "related_grant_ids": ["grant_003"],
  "tags": ["scholarship", "government", "2026"]
}
```

## Tekshirish

- `title` majburiy, maks 200 belgi
- `content` majburiy
- Kamida bitta tegishli ob'ekt yoki teg tavsiya etiladi
