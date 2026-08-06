# Backend — API Xizmati

## Mas'uliyatlar

- So'rovni tekshirish va tozalash
- API kalitlari orqali autentifikatsiya
- Tezlik cheklash
- Javob formatlash (JSON)
- Xatolarni boshqarish va holat kodlari

## So'rov jarayoni

```
HTTP So'rov
    │
    ▼
┌──────────────┐
│  Middleware  │
│  Stack       │────▶ Auth, Tezlik, Loglash, CORS
└──────┬───────┘
       ▼
┌──────────────┐
│  Router      │────▶ URL ni handler ga moslashtirish
└──────┬───────┘
       ▼
┌──────────────┐
│  Controller  │────▶ Tekshirish, xizmatni chaqirish, javobni formatlash
└──────┬───────┘
       ▼
┌──────────────┐
│  Xizmat      │────▶ Biznes mantiq
└──────────────┘
```

## Javob formati

Muvaffaqiyatli:
```json
{
  "data": { ... },
  "pagination": { ... }  // (agar ro'yxat bo'lsa)
}
```

Xato:
```json
{
  "error": {
    "code": "error_code",
    "message": "Inson o'qiy oladigan xato xabari"
  }
}
```
