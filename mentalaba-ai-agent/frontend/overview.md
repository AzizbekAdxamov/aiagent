# Frontend — Umumiy ma'lumot

## Texnologik stack

- **Framework:** React bilan Next.js
- **Til:** TypeScript
- **Stil:** Tailwind CSS yoki CSS Modules
- **Holat:** React Context yoki Zustand
- **Ikonkalar:** Lucide React yoki maxsus SVG ikonkalar

## Komponent arxitekturasi

```
pages/
  _app.tsx           — Ilova o'rami
  index.tsx          — Chat bilan asosiy sahifa
  universities/      — Universitet sahifalari
  directions/        — Yo'nalish sahifalari
  grants/            — Grant sahifalari
  news/              — Yangiliklar sahifalari

components/
  layout/            — Tartib komponentlari
  chat/              — Chat interfeys komponentlari
  cards/             — Ma'lumot ko'rsatish kartalari
  ui/                — Qayta foydalaniladigan UI komponentlari
    
hooks/               — Maxsus React hooklari
  useChat.ts
  useSession.ts
  useResponsive.ts
```

## Asosiy xususiyatlar

- Responsiv dizayn (mobil-birinchi)
- Real-time chat interfeysi
- Boy karta ko'rinishlari
- Animatsion o'tishlar
- Yuklanish skeletlari
- Xato chegaralari
- Foydalanish imkoniyati (WCAG mosligi)
