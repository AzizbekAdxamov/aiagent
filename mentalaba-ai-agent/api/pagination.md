# Paginatsiya

## Standart paginatsiya

Barcha ro'yxat endpointlari kursorga asoslangan paginatsiyani qo'llab-quvvatlaydi.

## So'rov parametrlari

| Parametr | Tur | Standart | Tavsif |
|----------|-----|----------|--------|
| `limit` | integer | 20 | Sahifadagi elementlar (maks: 100) |
| `cursor` | string | null | Paginatsiya uchun kursor |

## Javob formati

```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTB9",
    "has_more": true,
    "total": 156
  }
}
```

## Misol

```
GET /api/v1/universities?limit=10&cursor=eyJpZCI6MTB9
```
