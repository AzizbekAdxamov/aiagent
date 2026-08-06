# Yo'nalishlar — Filtrlar

## Mavjud filtrlar

| Filtr | Tur | Misol |
|--------|------|---------|
| `search` | string | `search=computer` |
| `category_id` | integer | `category_id=2` |
| `university_id` | string | `university_id=uni_123` |
| `degree_id` | integer | `degree_id=4` |
| `education_type_id` | integer | `education_type_id=1` |
| `language_id` | integer | `language_id=1` |
| `contract_type_id` | integer | `contract_type_id=1` |
| `subject_id` | integer | `subject_id=1` |
| `tuition_max` | number | `tuition_max=50000` |
| `duration` | number | `duration=4` |
| `has_transfer` | boolean | `has_transfer=true` |

## Birlashtirilgan misol

```
GET /api/v1/directions?category_id=2&degree_id=4&language_id=1&tuition_max=50000
```

Bu Muhandislik va Texnologiya yo'nalishidagi, ingliz tilida o'qitiladigan, to'lovi 50,000 ETB dan past bo'lgan bakalavr darajasidagi yo'nalishlarni qaytaradi.

## AI Agent foydalanishi

Filtrlar AI agent tomonidan foydalanuvchi so'rovlari asosida avtomatik qo'llaniladi:
- Foydalanuvchi: "Ingliz tilidagi arzon muhandislik bakalavr dasturlarini toping"
- Agent qo'llaydi: `category_id=2, degree_id=4, language_id=1, tuition_max=50000`
