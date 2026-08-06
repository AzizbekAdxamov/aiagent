# Autentifikatsiya

## API kaliti autentifikatsiyasi

Barcha API so'rovlari `Authorization` sarlavhasida API kalitini o'z ichiga olishi kerak:

```
Authorization: Bearer mb_sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## API kalit turlari

| Tur | Prefiks | Foydalanish |
|-----|---------|-------------|
| Jonli | `mb_sk_live_` | Ishlab chiqarish muhiti |
| Sinov | `mb_sk_test_` | Rivojlanish/testlash |

## Tezlik cheklash

Tezlik cheklovlari API kaliti bo'yicha qo'llaniladi. Batafsil ma'lumot uchun [Tezlik cheklovlari](rate_limits.md) ga qarang.

## Xato javoblari

| Holat kodi | Tavsif |
|------------|--------|
| 401 | API kaliti yo'q yoki noto'g'ri |
| 403 | API kaliti kerakli ruxsatlarga ega emas |
| 429 | Tezlik cheklovi oshib ketdi |
