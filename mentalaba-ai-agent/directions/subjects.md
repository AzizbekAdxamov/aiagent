# Yo'nalishlar — Fanlar

## Umumiy ma'lumot

Har bir yo'nalish qabul qilish uchun kerakli imtihon fanlariga ega. Bu talabalarga milliy imtihon fanlari asosida munosibligini aniqlashga yordam beradi.

## Ma'lumot modeli

```typescript
interface DirectionSubject {
  direction_id: string;
  subject_id: number;
  is_required: boolean;     // kerakli vs tavsiya etilgan
  min_grade: number | null;  // agar kerak bo'lsa, minimal baho
}
```

## Misollar

| Yo'nalish | Kerakli fanlar |
|-----------|----------------|
| Kompyuter fanlari | Matematika, Fizika, Ingliz tili |
| Tibbiyot | Biologiya, Kimyo, Fizika, Matematika |
| Huquq | Ingliz tili, Tarix, Fuqarolik |
| Buxgalteriya | Matematika, Ingliz tili, Iqtisod |
| Qurilish muhandisligi | Matematika, Fizika, Ingliz tili |

## AI Agent bilan muloqot

- "Kompyuter fanlari uchun menga qanday fanlar kerak?"
- "Menda Matematika, Fizika va Ingliz tili bor — nima o'qishim mumkin?"
- "Biologiyadan yaxshi ball oldim, tibbiy yo'nalishlar bormi?"
- "Ijtimoiy fanlar bilan qanday yo'nalishlarni olishim mumkin?"
