# Grantlar moduli — Umumiy ma'lumot

## Maqsad

Grantlar moduli stipendiya va moliyaviy yordam ma'lumotlarini boshqaradi. Talabalarga ta'limlari uchun moliyalashtirish imkoniyatlarini topishda yordam beradi.

## Ma'lumot modeli

```typescript
interface Grant {
  id: string;
  title: string;
  title_am: string;
  description: string;
  description_am: string;
  type: 'full' | 'partial' | 'tuition_only' | 'living_expenses';
  provider: string;
  provider_am: string;
  amount: number | null;
  currency: string;
  application_deadline: string;
  eligibility_criteria: string;
  eligibility_criteria_am: string;
  required_documents: string[];
  is_active: boolean;
}
```

## Kichik modullar

- **create.md** — Grant yaratish va sxema
- **user_side.md** — Foydalanuvchi tomoni grant xususiyatlari
- **relation.md** — Ob'ekt munosabatlari
- **filters.md** — Grant filtrlash variantlari
