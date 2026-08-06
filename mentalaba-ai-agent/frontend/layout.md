# Frontend — Tartib

## Umumiy tartib tuzilishi

```
┌────────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌────────────────────────────────────┐  │
│  │          │  │                                    │  │
│  │ Yanpanel │  │         Asosiy kontent              │  │
│  │          │  │                                    │  │
│  │  Tarix   │  │  ┌──────────────────────────────┐  │  │
│  │  Saqlan. │  │  │                              │  │  │
│  │  Sozlam. │  │  │        Chat xabarlari         │  │  │
│  │          │  │  │                              │  │  │
│  │          │  │  └──────────────────────────────┘  │  │
│  │          │  │                                    │  │
│  │          │  │  ┌──────────────────────────────┐  │  │
│  │          │  │  │                              │  │  │
│  │          │  │  │        Chat kiritish          │  │  │
│  │          │  │  │                              │  │  │
│  │          │  │  └──────────────────────────────┘  │  │
│  └──────────┘  └────────────────────────────────────┘  │
│                                                    │
│  ┌────────────────────────────────────────────────┐  │
│  │           Suzuvchi tugma (FAB)                  │  │
│  └────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

## Responsiv xatti-harakat

| Tanaffus nuqtasi | Tartib |
|-----------------|--------|
| ≥ 1024px | Yanpanel ko'rinadigan to'liq tartib |
| 768-1023px | Yanpanel yig'iladigan (o'tish tugmasi) |
| < 768px | To'liq ekranli chat, yanpanel qoplama sifatida |

## Grid tizimi

```
Ish stoli: yanpanel(300px) + asosiy(flex-1)
Planshet: yanpanel(0px, qoplama) + asosiy(100%)
Mobil: asosiy(100%), FAB ko'rinadi
```
