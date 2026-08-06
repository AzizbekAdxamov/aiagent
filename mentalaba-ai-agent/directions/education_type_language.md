# Yo'nalishlar — Ta'lim turi va tili

## Umumiy ma'lumot

Har bir yo'nalish bir nechta ta'lim turlari (kunduzgi, kechki va boshqalar) va tillarda (ingliz, amhar va boshqalar) taklif qilinishi mumkin.

## Ko'pdan-ko'pga munosabat

`direction_education_types` bog'lanish jadvali buni boshqaradi:

| direction_id | education_type_id | language_id |
|-------------|------------------|-------------|
| dir_001     | 1 (Kunduzgi)     | 1 (Ingliz) |
| dir_001     | 1 (Kunduzgi)     | 2 (Amhar) |
| dir_001     | 2 (Kechki)       | 2 (Amhar) |
| dir_002     | 1 (Kunduzgi)     | 1 (Ingliz) |

## API foydalanish

```
GET /api/v1/directions?education_type_id=1&language_id=1
```

Kunduzgi, ingliz tilidagi yo'nalishlarni qaytaradi.

## AI Agentda

AI agent ta'lim afzalliklari bo'yicha filtrlashi mumkin:
- "Amhar tilidagi kechki dasturlarni toping"
- "Ingliz tilidagi kunduzgi kompyuter fanlari"
- "Masofaviy ta'limda qaysi yo'nalishlar mavjud?"
