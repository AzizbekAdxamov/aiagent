# Universitetlar — Slug

## Slug formati

Sluglar ingliz tilidagi universitet nomidan olingan URL uchun qulay identifikatorlardir.

## Qoidalar

1. Nomni kichik harflarga o'tkazish
2. Bo'shliqlarni defis bilan almashtirish
3. Maxsus belgilarni olib tashlash
4. Noyoblik uchun qisqa hash yoki ID qo'shish

## Misollar

| Nom | Slug |
|-----|------|
| Addis Ababa University | `addis-ababa-university` |
| Bahir Dar University | `bahir-dar-university` |
| Jimma University | `jimma-university` |

## Noyoblik

Agar ikkita universitet bir xil slugga ega bo'lsa, noyob qo'shimcha qo'shiladi:

- `addis-ababa-university`
- `addis-ababa-university-2` (agar dublikat mavjud bo'lsa)

## Foydalanish

Sluglar quyidagilarda ishlatiladi:
- Ommaviy URL: `https://mentalaba.com/universities/addis-ababa-university`
- API qidiruvi: `GET /api/v1/universities/addis-ababa-university`
- SEO: Qidiruv tizimlari uchun toza URL
