# Navigatsiya — UI Hodisalar

## Maqsad

Navigatsiya harakatlari bilan ishga tushiriladigan UI interaksiya hodisalarini aniqlash.

## Hodisa turlari

### Bosish hodisalari
- `card.click` — Ma'lumot kartasiga bosish (universitet, yo'nalish, grant, yangilik)
- `button.click` — Harakat tugmasiga bosish
- `link.click` — Navigatsiya havolasiga bosish
- `suggestion.click` — Taklif kartasiga bosish

### Chat hodisalari
- `message.send` — Foydalanuvchi xabar yuboradi
- `message.receive` — Agent javob beradi
- `chat.open` — Chat oynasi ochiladi
- `chat.close` — Chat oynasi yopiladi

### Skroll hodisalari
- `scroll.to_bottom` — Foydalanuvchi chatning pastiga skrollaydi
- `scroll.to_top` — Foydalanuvchi yuqoriga skrollaydi
- `infinite_scroll.trigger` — Ko'proq natijalarni yuklash

### Holat hodisalari
- `state.loading` — Yuklash holati faollashtirilgan
- `state.loaded` — Yuklash tugallandi
- `state.error` — Xato holati faollashtirilgan
- `state.empty` — Natija topilmadi holati

## Hodisa jarayoni

```
Foydalanuvchi harakati → Navigatsiya harakati → Hodisa → Handler → UI yangilanishi
```

## Analitik kuzatish

Har bir hodisa quyidagilar bilan kuzatiladi:
- Hodisa nomi
- Vaqt tamg'asi
- Sessiya ID
- Ob'ekt konteksti (agar mavjud bo'lsa)
- Davomiylik (samaradorlik hodisalari uchun)
