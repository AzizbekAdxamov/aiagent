# Kontekst — Kesh

## Umumiy ma'lumot

Javob vaqtini yaxshilash va API xarajatlarini kamaytirish uchun keshlash strategiyasi.

## Kesh qatlamlari

### L1: Xotirada kesh
- Joriy sessiya konteksti
- Yaqinda qilingan qidiruv natijalari
- TTL: 5 daqiqa

### L2: Redis keshi
- Keng tarqalgan qidiruv natijalari
- Universitet/yo'nalish/grant ma'lumotlari
- Ma'lumotnomalar (viloyatlar, kategoriyalar va boshqalar)
- TTL: 1 soat (ma'lumotlar), 24 soat (ma'lumotnomalar)

### L3: Ma'lumotlar bazasi
- Asosiy ma'lumotlar ombori
- TTL yo'q

## Kesh kalitlari

```
university:{id}
university:{slug}
universities:search:{params_hash}
direction:{id}
directions:search:{params_hash}
grant:{id}
grants:search:{params_hash}
reference:{table_name}
```

## Bekor qilish

- Ma'lumot yangilanishi tegishli kesh kalitlarini bekor qiladi
- Ma'lumotnomalar sxema o'zgarishlarida bekor qilinadi
- Sessiya keshi sessiya muddati tugashida bekor qilinadi

## Afzalliklari

- Ma'lumotlar bazasi yukini kamaytiradi
- Tezroq javob vaqtlari
- Past LLM API xarajatlari (kamroq takroriy so'rovlar)
- Yaxshiroq foydalanuvchi tajribasi
