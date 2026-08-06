# Frontend — Mobil

## Mobilga oid mulohazalar

### Tartib
- To'liq ekranli chat interfeysi
- FAB pastki-o'ng burchakda joylashgan
- Yanpanel qoplama sifatida (chapdan surish)
- Karta tafsilotlari uchun pastki varaq

### Tegish interaksiyalari
- Tarix elementini o'chirish uchun chapga surish
- Yanpanelni yopish uchun pastga surish
- Kontekst menyusi uchun uzun bosish
- Galereyadagi rasmlarni kattalashtirish uchun chimchilash

### Pastki varaq
```
┌────────────────────────────┐
│  ─── (tortish dastasi)     │
│                            │
│  Karta tafsilotlari        │
│                            │
│  [Harakat tugmasi]         │
│  [Harakat tugmasi]         │
│  ──────────────────────    │
│  "Yopish uchun pastga suring"│
└────────────────────────────┘
```

### Mobil moslashuvlar

| Ish stoli | Mobil |
|-----------|-------|
| Yanpanel doim ko'rinadi | Yanpanel qoplama sifatida |
| Hover holatlari | Tegish feedback |
| Ko'p ustunli kartalar | Bir ustun |
| To'liq karta tafsilotlari | Pastki varaq ko'rinishi |
| Klaviatura yorliqlari | Imo-ishora navigatsiyasi |
| Maslahatlar | Maslahatlar yo'q (ma'lumot uchun teging) |

### Samaradorlik
- Rasmlarni kech yuklash
- Uzun suhbatlar uchun virtual ro'yxat
- Debounced qidiruv kiritish
- Past darajadagi qurilmalarda kamaytirilgan animatsiyalar
- Bundle hajmini optimallashtirish
