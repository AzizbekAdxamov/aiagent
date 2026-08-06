# Testlash — UI Testlari

## Test stsenariylari

### Chat interfeysi
- Xabar yuborish → javob olinadi
- Bo'sh kiritish → yuborish o'chirilgan
- Uzoq xabar → to'g'ri boshqaradi
- Kutish paytida yuklash holati ko'rinadi
- Muvaffaqiyatsizlikda xato holati ko'rinadi
- Taklif kartalari bosiladigan

### Karta komponentlari
- Universitet kartasi barcha maydonlarni ko'rsatadi
- Yo'nalish kartasi dastur ma'lumotini ko'rsatadi
- Grant kartasi stipendiya tafsilotlarini ko'rsatadi
- Kartalar barcha o'lchamlarda moslashuvchan
- Hover/faol holatlar ishlaydi
- Harakat tugmalari to'g'ri ishlaydi

### Navigatsiya
- Yanpanel ochiladi/yopiladi
- FAB chatni ochadi/yopadi
- Mobil yanpanel qoplamasi
- Mobil pastki varaq
- Tarix elementlari bosiladigan

### Responsiv dizayn
- Ish stoli (≥1024px) — to'liq tartib
- Planshet (768-1023px) — yig'iladigan yanpanel
- Mobil (<768px) — to'liq ekranli chat
- Tegish interaksiyalari ishlaydi
- Gorizontal skroll yo'q

## Test vositalari

- **Birlik**: Jest + React Testing Library
- **E2E**: Cypress yoki Playwright
- **Vizual**: Komponent kutubxonasi uchun Storybook
- **Foydalanish imkoniyati**: axe-core
