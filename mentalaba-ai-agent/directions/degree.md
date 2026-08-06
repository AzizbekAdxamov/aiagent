# Yo'nalishlar — Daraja

## Umumiy ma'lumot

Har bir yo'nalish bir nechta daraja darajalarida taklif qilinishi mumkin.

## Daraja darajalari

| ID | Daraja | Odatdagi davomiylik |
|----|--------|---------------------|
| 1 | Sertifikat | 1 yil |
| 2 | Diplom | 2-3 yil |
| 3 | Yuqori diplom | 3-4 yil |
| 4 | Bakalavr | 4-5 yil |
| 5 | Magistr | 2 yil |
| 6 | Doktorantura | 3-5 yil |

## API

```
GET /api/v1/directions?degree_id=4
```

Bakalavr darajasini taklif qiladigan yo'nalishlarni qaytaradi.

## AI Agentda

- "Qaysi universitetlarda kompyuter fanlari magistri bor?"
- "Menga hamshiralik bo'yicha diplom dasturlarini ko'rsat"
- "Iqtisod bo'yicha PhD kerak"
