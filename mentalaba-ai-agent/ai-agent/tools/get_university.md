# Vosita: get_university

## Tavsif
ID yoki slug bo'yicha ma'lum bir universitet haqida batafsil ma'lumot oladi.

## Parametrlar

| Parametr | Tur | Majburiy | Tavsif |
|----------|-----|----------|--------|
| `id` | string | Yo'q | Universitet ID si |
| `slug` | string | Yo'q | Universitet slugi |

## Chaqiruv misoli

```json
{
  "name": "get_university",
  "parameters": {
    "slug": "addis-ababa-university"
  }
}
```

## Qaytaradi

```json
{
  "id": "uni_123",
  "slug": "addis-ababa-university",
  "name": "Addis Ababa University",
  "name_am": "አዲስ አበባ ዩኒቨርሲቲ",
  "region": "Addis Ababa",
  "type": "University",
  "description": "...",
  "website": "https://www.aau.edu.et",
  "student_count": 48000,
  "direction_count": 120,
  "has_dormitory": true
}
```

## Xatolarni boshqarish

- Agar na `id` na `slug` berilmasa: "Iltimos, universitet ID si yoki slugini bering"
- Agar universitet topilmasa: "Universitet topilmadi. Iltimos, identifikatorni tekshiring."
