# Backend jarayoni

## Xizmat arxitekturasi

```
So'rov ──▶ API Xizmati ──▶ Vosita Routeri ──▶ Intentsiya Routeri
                                                      │
                                              ┌───────┴───────┐
                                              │  Xizmat qatlami│
                                              └───────┬───────┘
                                                      │
                                        ┌─────────────┼─────────────┐
                                        ▼             ▼             ▼
                                  ┌──────────┐ ┌──────────┐ ┌──────────┐
                                  │Universi- │ │Yo'nalish │ │  Grant   │
                                  │tet Xiz.  │ │ Xizmati  │ │ Xizmati  │
                                  └────┬─────┘ └────┬─────┘ └────┬─────┘
                                       │             │             │
                                       └─────────────┼─────────────┘
                                                     ▼
                                              ┌──────────┐
                                              │  Kesh    │
                                              └────┬─────┘
                                                   │
                                                   ▼
                                              ┌──────────┐
                                              │Ma'lumotlar│
                                              │  bazasi  │
                                              └──────────┘
```

## Xizmat vazifalari

### API Xizmati
- So'rovni tekshirish va tozalash
- Autentifikatsiya/avtorizatsiya
- Tezlik cheklash
- Javobni formatlash

### Vosita Routeri
- LLM dan vosita chaqiruvlarini qabul qilish
- Parametrlarni tekshirish
- Tegishli xizmatga yo'naltirish
- Strukturali ma'lumotlarni qaytarish

### Intentsiya Routeri
- Foydalanuvchi xabarlarini tasniflash
- Tegishli ishlovchiga yo'naltirish
- Zaxira uchun ishonch balli

### LLM Xizmati
- LLM API chaqiruvlarini boshqarish
- Oqimli javoblarni qayta ishlash
- Token boshqaruvi va xarajatlarni optimallashtirish

### Kesh qatlami
- Redis asosidagi keshlash
- TTL asosidagi bekor qilish
- So'rov natijalarini keshlash
- Sessiya ma'lumotlarini keshlash

### Qidiruv mexanizmi
- Ob'ektlar bo'ylab to'liq matnli qidiruv
- Foydalanuvchi so'rovlari uchun noaniq moslik
- Aloqadorlik asosidagi tartiblash
- Faceted filtrlash
