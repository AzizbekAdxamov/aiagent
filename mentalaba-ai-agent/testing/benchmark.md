# Testlash — Benchmark

## Samaradorlik benchmarklari

### API javob vaqtlari

| Endpoint | Maqsad | Ogohlantirish | Kritik |
|----------|--------|---------------|--------|
| GET /universities | < 500ms | 500ms-1s | > 1s |
| GET /universities/:id | < 200ms | 200ms-500ms | > 500ms |
| POST /chat | < 3s (birinchi token) | 3s-5s | > 5s |
| GET /directions | < 500ms | 500ms-1s | > 1s |
| GET /grants | < 500ms | 500ms-1s | > 1s |

### LLM samaradorligi

| Ko'rsatkich | Maqsad | Ogohlantirish |
|-------------|--------|---------------|
| Intentsiyani tasniflash | < 1s | > 1s |
| Javob yaratish | < 3s | > 3s |
| Vositani bajarish | < 500ms | > 1s |
| Jami aylanish | < 5s | > 8s |

### Frontend samaradorligi

| Ko'rsatkich | Maqsad |
|-------------|--------|
| Birinchi mazmunli bo'yash | < 1.5s |
| Eng katta mazmunli bo'yash | < 2.5s |
| Birinchi kirish kechikishi | < 100ms |
| Kumulyativ tartib siljishi | < 0.1 |
| Interaktiv bo'lish vaqti | < 3s |

## Yuk testlash

- Bir vaqtda foydalanuvchilar: 1000 maqsad
- Soniyada so'rovlar: 100 maqsad
- Xato darajasi: < 0.1%
- P99 kechikish: < 2s

## Benchmark vositalari

- API yuk testlash uchun k6
- Frontend samaradorligi uchun Lighthouse
- LLMga oid: maxsus token vaqti
- Ma'lumotlar bazasi: PostgreSQL uchun pgbench
