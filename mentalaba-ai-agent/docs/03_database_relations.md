# Ma'lumotlar bazasi munosabatlari

## Ob'ekt munosabatlari sharhi

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Universitet│────▶│  Yo'nalish       │────▶│  Grant       │
│             │     │  (Ta'lim         │     │  (Stipendiya │
│             │     │   Dasturi)       │     │   Ma'lumoti) │
└─────────────┘     └──────────────────┘     └──────────────┘
       │                     │                       │
       │                     │                       │
       ▼                     ▼                       ▼
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Galereya  │     │   To'lov         │     │  Grant       │
│   (Rasmlar) │     │   Ma'lumoti      │     │  Filtrlash   │
└─────────────┘     └──────────────────┘     └──────────────┘
       │                     │
       │                     │
       ▼                     ▼
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│ Qabul       │     │   Fan            │     │  Yangiliklar │
│ Ma'lumoti   │     │   Talablari      │     │              │
└─────────────┘     └──────────────────┘     └──────────────┘
```

## Asosiy jadvallar

- **universities** — Oliy ta'lim muassasalari
- **directions** — Akademik dasturlar va ta'lim sohalari
- **grants** — Stipendiya va moliyaviy yordam imkoniyatlari
- **news** — Ta'limga oid yangiliklar va xabarlar
- **users** — Platforma foydalanuvchilari (ixtiyoriy, kelajak)

## Munosabat jadvallari

- **university_directions** — Ko'pdan-ko'pga: universitetlar ↔ yo'nalishlar
- **direction_grants** — Ko'pdan-ko'pga: yo'nalishlar ↔ grantlar
- **direction_subjects** — Yo'nalish uchun talab qilinadigan imtihon fanlari
- **university_gallery** — Universitet bilan bog'liq rasmlar
- **news_tags** — Yangiliklar maqolalari uchun teglar

## Ma'lumotnoma jadvallari

- viloyatlar, muassasa kategoriyalari, muassasa turlari
- ta'lim tillari, ta'lim turlari, darajalar
- shartnoma turlari, yo'nalish kategoriyalari, fanlar, imtihon fanlari
