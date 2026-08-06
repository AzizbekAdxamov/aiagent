# Testlash — Chegara holatlari

## API chegara holatlari

### Tezlik cheklash
- Bir nechta tezkor so'rovlar 429 ni ishga tushiradi
- Retry-After sarlavhasi mavjud
- Tezlik cheklovida chiroyli pasayish
- Portlash so'rovlari uchun navbat boshqaruvi

### Ma'lumot chegara holatlari
- Bo'sh qidiruv natijalari
- Yo'nalishlari bo'lmagan universitet
- Miqdori ko'rsatilmagan grant
- Tegishli ob'ektlari bo'lmagan yangilik
- Juda uzun nomlar (qisqartirishni boshqarish)
- Nomlardagi maxsus belgilar
- Qidiruvdagi o'zbekcha matn

### Tarmoq chegara holatlari
- Oflayn rejim xatti-harakati
- Sekin tarmoq uzilishini boshqarish
- Server xatosi (500) tiklanishi
- Qisman javobni boshqarish
- WebSocket uzilishi

### Foydalanuvchi kiritish chegara holatlari
- Bo'sh xabar yuborish
- Juda uzun xabarlar (>1000 belgi)
- Maxsus belgilar va emoji
- Aralash o'zbek/ingliz matni
- Xabarlardagi URL'lar
- Qidiruvdagi kod/belgilar

## Test strategiyasi

- Ma'lumot modellari uchun xususiyatga asoslangan testlash
- Tarmoq nosozliklari uchun xaos muhandisligi
- Bir vaqtda foydalanuvchilar uchun yuk testlash
- Kiritish tekshirish uchun fuzz testlash
- UI uchun vizual regressiya testlash
