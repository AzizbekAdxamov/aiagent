# Tezlik cheklovlari

## Standart cheklovlar

| Daraja | So'rovlar/Daqiqa | Portlash |
|--------|------------------|----------|
| Bepul | 60 | 10 |
| Asosiy | 300 | 50 |
| Pro | 1000 | 100 |

## Sarlavhalar

Tezlik cheklovi ma'lumoti javob sarlavhalariga kiritilgan:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1620000000
```

## Cheklovlarni oshirish

Tezlik cheklovidan oshib ketganda, API qaytaradi:

- **Holat:** 429 Too Many Requests
- **Retry-After:** N (qayta urinishgacha soniyalar)

## Eng yaxshi amaliyotlar

1. Eksponensial orqaga qaytishni amalga oshirish
2. Iloji bo'lganda javoblarni keshlash
3. Ommaviy operatsiyalar uchun ommaviy endpointlardan foydalanish
4. Keraksiz so'rovlarni minimallashtirish
