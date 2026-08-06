# Backend — Kesh

## Strategiya

Optimal samaradorlik uchun ko'p darajali keshlash.

## Kesh darajalari

### 1-daraja: Xotirada (Node.js)
- Eng tezkor kirish (mikrosoniyalar)
- Sessiya ma'lumotlari, yaqinda qilingan so'rovlar
- Maksimal hajm: 100MB
- Chiqarish: LRU

### 2-daraja: Redis
- Instance'lar o'rtasida ulashilgan
- Tez-tez so'raladigan so'rovlar, ma'lumotnomalar
- Kesh turiga qarab sozlanishi mumkin bo'lgan TTL
- Maksimal xotira: 1GB (sozlanishi)

## Kesh siyosatlari

| Ma'lumot turi | Kesh darajasi | TTL | Bekor qilish |
|---------------|---------------|-----|--------------|
| Universitet tafsiloti | L2 Redis | 1 soat | Yangilanishda |
| Universitet ro'yxati | L2 Redis | 30 daqiqa | Yangilanishda |
| Yo'nalish ma'lumoti | L2 Redis | 1 soat | Yangilanishda |
| Grant ma'lumoti | L2 Redis | 1 soat | Yangilanishda |
| Ma'lumotnomalar | L2 Redis | 24 soat | Qo'lda |
| Qidiruv natijalari | L1 + L2 | 5 daqiqa | Vaqt asosida |
| Sessiya ma'lumoti | L1 | Sessiya muddati | Sessiya tugashida |
| Foydalanuvchi afzalliklari | L2 Redis | 24 soat | Yangilanishda |

## Kesh-chekka namunasi

```
So'rov → Keshni tekshirish → Keshda bor? → Keshni qaytarish
                                ↓ (Yo'q)
                        Ma'lumotlar bazasidan so'rash
                              ↓
                        Keshlash
                              ↓
                        Natijani qaytarish
```
