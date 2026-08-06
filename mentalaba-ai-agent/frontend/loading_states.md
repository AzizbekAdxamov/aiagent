# Frontend — Yuklanish holatlari

## Yuklanish holatlari

### Skelet kartalar
- Animatsion shimmer o'rinbosar
- Haqiqiy kartalar bilan bir xil o'lchamlar
- Ma'lumot olish paytida paydo bo'ladi

### Skelet matn
- Matn kontenti uchun animatsion chiziqlar
- Kenglik o'zgaradi (konteynerning 60-100%)
- Bosqichma-bosqich animatsiya

### Yozish ko'rsatkichi
```
Mentalaba o'ylamoqda...
⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏
```

Avatar bilan uchta sakrab turuvchi nuqta animatsiyasi.

### Rivojlanish paneli
- Chatning yuqori qismida noaniq panel
- Animatsion gradient
- Uzoq operatsiyalar uchun ishlatiladi

## Vaqt

| Operatsiya | Feedback |
|------------|----------|
| Tezkor (< 300ms) | Yuklash ko'rsatkichi kerak emas |
| Tez (300ms-1s) | Ichki spinner |
| O'rta (1-3s) | Skelet kartalar |
| Sekin (> 3s) | Rivojlanish + xabar |
