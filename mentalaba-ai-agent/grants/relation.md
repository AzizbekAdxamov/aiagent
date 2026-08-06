# Grantlar — Munosabatlar

## Ob'ekt munosabatlari

```
┌───────┐
│ Grant │
└───┬───┘
    │
    ├──▶ Universitet (grantni taklif qiluvchi/o'tkazuvchi)
    │      - Ko'pdan-birga
    │
    ├──▶ Yo'nalishlar (grantga mos dasturlar)
    │      - Ko'pdan-ko'pga: direction_grants orqali
    │
    └──▶ Yangiliklar (grantlar haqida e'lonlar)
           - Ko'pdan-ko'pga: news_tags orqali
```

## So'rov misoli

```sql
-- Grantlarni ularning universitetlari va yo'nalishlari bilan olish
SELECT 
  g.title,
  u.name as university,
  array_agg(d.name) as directions
FROM grants g
JOIN universities u ON g.university_id = u.id
LEFT JOIN direction_grants dg ON g.id = dg.grant_id
LEFT JOIN directions d ON d.id = dg.direction_id
GROUP BY g.title, u.name;
```
