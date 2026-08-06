# AI Agent — Umumiy ma'lumot

## Maqsad

AI Agent Mentalaba platformasining aqlli yadrosidir. U tabiiy til so'rovlarini qayta ishlaydi, foydalanuvchi intentsiyasini aniqlaydi, tegishli ma'lumotlarni oladi va foydali javoblarni yaratadi.

## Arxitektura

```
Foydalanuvchi so'rovi
    │
    ▼
┌──────────────┐
│  Intentsiya  │────▶ [university_search, direction_search,
│  Klassifik.  │       grant_search, comparison, admission,
└──────────────┘       transfer, faq]
    │
    ▼
┌──────────────┐
│  Vosita      │────▶ [search_university, get_university,
│  Routeri     │       search_direction, search_grants,
└──────────────┘       search_news, compare_universities,
                       recommend, navigation]
    │
    ▼
┌──────────────┐
│  LLM Xizmati │────▶ Tabiiy til javobini yaratish
└──────────────┘
    │
    ▼
┌──────────────┐
│  Kontekst    │────▶ Sessiya/xotira boshqaruvi
│  Boshqaruvch │
└──────────────┘
```

## Asosiy komponentlar

- **Prompts/** — Tizim, ishlab chiqaruvchi, tavsiya, qidiruv va zaxira promplari
- **Tools/** — Agent chaqira oladigan modulli funksiyalar
- **Intents/** — Foydalanuvchi so'rovlarini tasniflash ta'riflari
- **Context/** — Xotira, sessiya, tarix va kesh boshqaruvi
- **Recommendation/** — Shaxsiylashtirilgan taklif mexanizmi
- **Conversation/** — Suhbat oqimi shablonlari (salomlashish, kuzatish va boshqalar)
