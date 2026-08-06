# Universitetlar moduli — Umumiy ma'lumot

## Maqsad

Universitetlar moduli barcha oliy ta'lim muassasalari ma'lumotlarini boshqaradi. U qidiruv, batafsil ko'rinish, galereya, qabul ma'lumoti, grantlar va SEO metama'lumotlarini taqdim etadi.

## Ma'lumot modeli

```typescript
interface University {
  id: string;
  slug: string;
  name: string;
  name_am: string;          // Amhar tilidagi nomi
  region_id: number;
  institution_type_id: number;
  category_id: number;
  established_year: number;
  website: string;
  description: string;
  description_am: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string;
  cover_image_url: string;
  student_count: number;
  has_dormitory: boolean;
  has_library: boolean;
  has_lab: boolean;
  is_active: boolean;
}
```

## Kichik modullar

- **list.md** — Ro'yxat va qidiruv
- **detail.md** — Batafsil ko'rinish
- **slug.md** — Slug yaratish va URL bilan ishlash
- **user_side.md** — Foydalanuvchi tomoni xususiyatlari
- **gallery.md** — Rasm galereyasi boshqaruvi
- **grants.md** — Universitetga oid grantlar
- **admission.md** — Qabul talablari va jarayoni
- **seo.md** — SEO metama'lumotlarini optimallashtirish
- **relations.md** — Tegishli ob'ektlar

## API Endpointlar

- `GET /api/v1/universities` — Ro'yxat (paginatsiyalangan, filtrlanadigan)
- `GET /api/v1/universities/:id` — Batafsil
- `GET /api/v1/universities/:slug` — Slug bo'yicha batafsil
- `GET /api/v1/universities/:id/gallery` — Galereya rasmlari
- `GET /api/v1/universities/:id/grants` — Universitetdagi grantlar
- `GET /api/v1/universities/:id/directions` — Universitetdagi yo'nalishlar
