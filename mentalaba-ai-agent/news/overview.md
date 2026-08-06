# Yangiliklar moduli — Umumiy ma'lumot

## Maqsad

Yangiliklar moduli ta'limga oid yangiliklar, e'lonlar va yangilanishlarni boshqaradi. Talabalarni Efiopiya oliy ta'limidagi so'nggi o'zgarishlardan xabardor qiladi.

## Ma'lumot modeli

```typescript
interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  title_am: string;
  excerpt: string;
  excerpt_am: string;
  content: string;
  content_am: string;
  cover_image_url: string;
  author: string;
  published_at: string;
  is_featured: boolean;
  is_active: boolean;
}
```

## Kichik modullar

- **create.md** — Maqola yaratish
- **related_to.md** — Boshqa ob'ektlar bilan munosabatlar
- **tags.md** — Teglash tizimi
- **seo.md** — SEO optimallashtirish
