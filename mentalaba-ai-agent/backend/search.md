# Backend — Qidiruv

## Qidiruv mexanizmi

Barcha ob'ekt turlari bo'ylab to'liq matnli qidiruv.

## Amalga oshirish variantlari

| Variant | Afzalliklari | Kamchiliklari |
|---------|-------------|---------------|
| PostgreSQL To'liq Matnli Qidiruv | O'rnatilgan, qo'shimcha infra yo'q | Cheklangan xususiyatlar |
| Elasticsearch | Kuchli, masshtablanadigan | Qo'shimcha infratuzilma |
| MeiliSearch | Tez, sozlash oson | O'z-o'zini joylashtirish kerak |
| Typesense | Tez, oddiy API | Bulut/o'z-o'zini joylashtirish |

## Qidiruv xususiyatlari

- Nom va tavsiflarda to'liq matnli qidiruv (EN + AM)
- Xatolar uchun noaniq moslik
- Faceted filtrlash (viloyat, tur, kategoriya)
- Aloqadorlik asosidagi reyting
- Avtoto'ldirish/takliflar
- Paginatsiya

## Indeks konfiguratsiyasi

### Universitetlar indeksi
```json
{
  "searchableAttributes": ["name", "name_am", "description"],
  "filterableAttributes": ["region_id", "type_id", "category_id"],
  "sortableAttributes": ["student_count", "established_year"]
}
```

### Yo'nalishlar indeksi
```json
{
  "searchableAttributes": ["name", "name_am", "description"],
  "filterableAttributes": ["category_id", "degree_id", "language_id"]
}
```
