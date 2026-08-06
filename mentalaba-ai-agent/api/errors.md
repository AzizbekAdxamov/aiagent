# API xatolari

## Xato javob formati

```json
{
  "error": {
    "code": "not_found",
    "message": "So'ralgan resurs topilmadi.",
    "details": {
      "resource": "university",
      "id": "noto'g'ri-id"
    }
  }
}
```

## Keng tarqalgan xato kodlari

| Kod | HTTP Status | Tavsif |
|-----|-------------|--------|
| `bad_request` | 400 | So'rov parametrlari noto'g'ri |
| `unauthorized` | 401 | Autentifikatsiya yo'q yoki noto'g'ri |
| `forbidden` | 403 | Ruxsatlar yetarli emas |
| `not_found` | 404 | Resurs topilmadi |
| `rate_limited` | 429 | Juda ko'p so'rov yuborildi |
| `validation_error` | 422 | So'rovni tekshirish muvaffaqiyatsiz |
| `internal_error` | 500 | Ichki server xatosi |
| `service_unavailable` | 503 | Xizmat vaqtincha mavjud emas |
