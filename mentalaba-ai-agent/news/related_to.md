# Yangiliklar — Tegishli

## Umumiy ma'lumot

Yangilik maqolalari universitetlar, yo'nalishlar, grantlar yoki boshqa ob'ektlarga tegishli bo'lishi mumkin. Bu bog'langan ma'lumotlar tarmog'ini yaratadi.

## Munosabatlar jadvali

```sql
CREATE TABLE news_relations (
    news_id UUID REFERENCES news(id),
    entity_type VARCHAR(50),   -- 'university', 'direction', 'grant'
    entity_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (news_id, entity_type, entity_id)
);
```

## Misollar

| Yangilik maqolasi | Tegishli | Tur |
|------------------|----------|-----|
| AAU yangi kutubxona oldi | Addis Ababa University | university |
| Muhandislik granti 2026 | Qurilish muhandisligi | direction |
| Yangi stipendiya | AAU Merit Scholarship | grant |
| Ta'lim islohoti | Ta'lim vazirligi | - (umumiy) |

## API

```
GET /api/v1/universities/:id/news  — Universitet haqidagi yangiliklar
GET /api/v1/directions/:id/news     — Yo'nalish haqidagi yangiliklar
GET /api/v1/grants/:id/news         — Grant haqidagi yangiliklar
```
