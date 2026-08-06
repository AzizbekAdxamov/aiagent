# AI agent jarayoni

## Agent qaror qabul qilish tizimi

```
Foydalanuvchi xabari
    │
    ▼
┌──────────────────────┐
│    Kirishni qayta    │
│    ishlash           │
│  - Tozalash          │
│  - Tokenlashtirish   │
│  - Tilni aniqlash    │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  Intentsiyalarni     │
│  tasniflash          │
│  - University Search │
│  - Direction Search  │
│  - Grant Search      │
│  - Comparison        │
│  - Admission         │
│  - Transfer          │
│  - FAQ/General       │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│   Kontekstni yig'ish │
│  - Sessiya tarixi    │
│  - Foydalanuvchi     │
│    afzalliklari      │
│  - Xotira qidiruvi   │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│   Prompt yaratish    │
│  - Tizim Prompti     │
│  - Ishlab Chiquvchi  │
│    Prompti           │
│  - Vosita Ta'riflari │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  LLM chaqiruvi       │
│  - Model tanlash     │
│  - Temperatura sozl. │
│  - Vositani bajarish │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│   Javobni shakllant. │
│  - Strukturali chiq. │
│  - Karta/Havola      │
│  - Kuzatish taklifl. │
└──────────┬───────────┘
           ▼
      Foydalanuvchi oladi
```

## Vositani bajarish jarayoni

LLM vositani ishlatishga qaror qilganda:

1. LLM parametrlar bilan vosita chaqiruvini qaytaradi
2. Vosita router parametrlarni tekshiradi
3. Backend xizmat so'rovni bajaradi
4. Natijalar LLM iste'moli uchun formatlanadi
5. LLM ma'lumotlar bilan tabiiy til javobini yaratadi

## Zaxira strategiyasi

Agar intentsiyani tasniflash ishonchi past bo'lsa:
1. Aniqlashtiruvchi savol berish (clarification prompt)
2. Umumiy javoblar uchun zaxira promptidan foydalanish
3. Foydalanuvchiga keng tarqalgan intentsiyalarni taklif qilish
