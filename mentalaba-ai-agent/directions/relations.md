# Yo'nalishlar — Munosabatlar

## Ob'ekt munosabatlari

```
┌───────────┐
│ Yo'nalish │
└─────┬─────┘
      │
      ├──▶ Universitetlar (ushbu yo'nalishni taklif qiluvchi)
      │      - Ko'pdan-ko'pga: university_directions orqali
      │
      ├──▶ Ta'lim turlari (kunduzgi, kechki va boshqalar)
      │      - Ko'pdan-ko'pga: direction_education_types orqali
      │
      ├──▶ Tillar (ingliz, amhar va boshqalar)
      │      - direction_education_types orqali bog'langan
      │
      ├──▶ To'lov ma'lumoti (shartnoma turi bo'yicha to'lovlar)
      │      - Birdan-ko'pga: direction_tuition orqali
      │
      ├──▶ Darajalar (sertifikat, bakalavr va boshqalar)
      │      - Ko'pdan-ko'pga: direction_degree orqali
      │
      ├──▶ Fanlar (kirish talablari)
      │      - Ko'pdan-ko'pga: direction_subjects orqali
      │
      ├──▶ Grantlar (ushbu yo'nalish uchun mavjud)
      │      - Ko'pdan-ko'pga: direction_grants orqali
      │
      └──▶ Qabul ma'lumoti
             - Birdan-birga
```

## So'rov misoli

```sql
-- Yo'nalishni taklif qiluvchi universitetlarni to'lov ma'lumoti bilan olish
SELECT u.name, dt.amount, ct.name as contract_type
FROM directions d
JOIN university_directions ud ON d.id = ud.direction_id
JOIN universities u ON u.id = ud.university_id
JOIN direction_tuition dt ON d.id = dt.direction_id AND u.id = dt.university_id
JOIN contract_types ct ON dt.contract_type_id = ct.id
WHERE d.slug = 'computer-science';
```
