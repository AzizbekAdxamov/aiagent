# Vosita: search_news

## Tavsif
Ta'lim yangiliklari maqolalarini qidirish.

## Parametrlar

| Parametr | Tur | Majburiy | Tavsif |
|----------|-----|----------|--------|
| `search` | string | Yo'q | Qidiruv so'rovi |
| `tags` | string | Yo'q | Vergul bilan ajratilgan teglar |
| `university_id` | string | Yo'q | Tegishli universitet bo'yicha filtrlash |
| `direction_id` | string | Yo'q | Tegishli yo'nalish bo'yicha filtrlash |
| `grant_id` | string | Yo'q | Tegishli grant bo'yicha filtrlash |
| `limit` | integer | Yo'q | Natijalar chegarasi |

## Chaqiruv misoli

```json
{
  "name": "search_news",
  "parameters": {
    "tags": "scholarship",
    "limit": 5
  }
}
```

---

# Vosita: compare_universities

## Tavsif
Bir nechta universitetlarni yonma-yon taqqoslash.

## Parametrlar

| Parametr | Tur | Majburiy | Tavsif |
|----------|-----|----------|--------|
| `university_ids` | array | Ha | Universitet ID'lari massivi (2-4) |

## Chaqiruv misoli

```json
{
  "name": "compare_universities",
  "parameters": {
    "university_ids": ["uni_001", "uni_005", "uni_010"]
  }
}
```

## Taqqoslash kategoriyalari

- Umumiy ma'lumot (tashkil etilgan, turi, joylashuvi)
- Akademik takliflar (yo'nalishlar soni, darajalar)
- Imkoniyatlar (yotoqxona, kutubxona, laboratoriyalar)
- Talabalar soni
- To'lov diapazonlari
- Mavjud grantlar
