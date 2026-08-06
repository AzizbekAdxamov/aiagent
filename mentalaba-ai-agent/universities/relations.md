# Universitetlar — Munosabatlar

## Ob'ekt munosabatlari

```
┌──────────────┐
│  Universitet │
└──────┬───────┘
       │
       ├──▶ Yo'nalishlar (akademik dasturlar)
       │      - Ko'pdan-ko'pga: university_directions orqali
       │      - Aloqadorlik/mashhurlik bo'yicha tartiblangan
       │
       ├──▶ Grantlar (stipendiyalar)
       │      - Birdan-ko'pga
       │      - Grant turi bo'yicha filtrlangan
       │
       ├──▶ Galereya (rasmlar)
       │      - Birdan-ko'pga
       │      - Tur va ustuvorlik bo'yicha tartiblangan
       │
       ├──▶ Qabul ma'lumoti
       │      - Birdan-birga
       │      - Alohida qabul turlari
       │
       └──▶ Yangiliklar (universitet haqida maqolalar)
              - Ko'pdan-ko'pga: news_tags/related_to orqali
```

## So'rov misollari

```sql
-- Universitetning barcha yo'nalishlarini olish
SELECT d.* FROM directions d
JOIN university_directions ud ON d.id = ud.direction_id
WHERE ud.university_id = ?;

-- Universitetning barcha grantlarini olish
SELECT * FROM grants WHERE university_id = ?;

-- Har bir universitetdagi yo'nalishlar sonini hisoblash
SELECT u.id, u.name, COUNT(ud.direction_id) as direction_count
FROM universities u
LEFT JOIN university_directions ud ON u.id = ud.university_id
GROUP BY u.id, u.name;
```
