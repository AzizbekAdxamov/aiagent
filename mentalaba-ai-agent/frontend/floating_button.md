# Frontend — Suzuvchi tugma (FAB)

## Maqsad

Suzuvchi harakat tugmasi istalgan sahifadan chat interfeysiga tezkor kirishni ta'minlaydi.

## Xatti-harakat

### Holatlar

| Holat | Ko'rinish | Xatti-harakat |
|-------|------------|----------|
| Standart | Kichik chat ikonkasi (💬) | Pastki-o'ng burchakda ko'rinadi |
| Hover | Bir oz kattalashadi | Maslahat: "Mentalaba bilan suhbatlashish" |
| Faol | X (✕) ga aylanadi | Chat oynasi ochiladi/yopiladi |
| O'qilmagan bildirishnoma | Qizil nishon bilan hisob | Kutilayotgan xabarlarni ko'rsatadi |
| Mobil | Kattaroq teginish maqsadi | Xuddi shunday xatti-harakat |

### Joylashuv

- Pastki-o'ng burchak
- Chekkalardan 24px
- Ruxsatlangan joylashuv (skrollanmaydi)
- Barcha kontentdan yuqori Z-index
- 56×56px standart o'lcham

### Animatsiya

- Silliq masshtab va aylanish o'tishi (300ms)
- Chat oynasi pastdan yuqoriga siljiydi
- Orqa fon qoplamasi xiralashadi (mobil)

## Foydalanish imkoniyati

- aria-label: "Chatni ochish"
- Klaviatura yorlig'i: Ctrl+Shift+C
- Ko'rinadigan fokus halqasi
- Ekran o'quvchi holat o'zgarishi haqida e'lon
