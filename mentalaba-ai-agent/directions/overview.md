# Yo'nalishlar moduli — Umumiy ma'lumot

## Maqsad

Yo'nalishlar moduli akademik dasturlar va ta'lim sohalarini (የትምህርት አቅጣጫዎች) boshqaradi. Talabalarga dasturlarni kashf etish, variantlarni taqqoslash va qabul talablarini topishda yordam beradi.

## Ma'lumot modeli

```typescript
interface Direction {
  id: string;
  slug: string;
  name: string;
  name_am: string;
  category_id: number;
  description: string;
  description_am: string;
  duration_years: number;
  is_active: boolean;
}
```

## Kichik modullar

- **create_schema.md** — Sxema ta'rifi
- **education_type_language.md** — Ta'lim turlari va tillari
- **tuition.md** — To'lov ma'lumotlari
- **degree.md** — Taklif etiladigan daraja darajalari
- **subjects.md** — Kerakli fanlar
- **transfer.md** — Dasturlar o'rtasida transfer
- **admission.md** — Qabul talablari
- **relations.md** — Ob'ekt munosabatlari
- **filters.md** — Filtrlash variantlari
