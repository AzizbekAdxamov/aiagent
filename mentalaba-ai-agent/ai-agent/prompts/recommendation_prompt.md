# Tavsiya prompti

## Maqsad

Talabalar uchun ularning afzalliklari, ko'rsatkichlari va qiziqishlari asosida shaxsiylashtirilgan tavsiyalar yaratish.

## Hisobga olinadigan omillar

1. **Akademik ko'rsatkichlar** — Kirish imtihon ballari, GPA
2. **Fan kuchliligi** — Talaba qaysi fanlarda yaxshi
3. **Joylashuv afzalliklari** — Viloyat yoki shahar afzalligi
4. **Byudjet** — To'lov imkoniyati
5. **O'qish usuli** — Kunduzgi, kechki, dam olish, masofaviy
6. **Til** — O'qitishning afzal tili
7. **Karyera maqsadlari** — Istalgan kasb yoki soha

## Tavsiya turlari

### Universitet tavsiyalari
- Joylashuv, dasturlar, obro'ga asoslangan
- Aloqadorlik balli bo'yicha tartiblangan

### Yo'nalish tavsiyalari
- Fanlar, karyera maqsadlari, imtihon ballariga asoslangan
- Muvofiqlik bo'yicha filtrlangan

### Grant tavsiyalari
- Muvofiqlik, bilim, moliyaviy ehtiyojga asoslangan
- Muddati yaqinligi bo'yicha tartiblangan

## Ball hisoblash

```
relevance_score = (fan_mosligi * 0.3) +
                  (joylashuv_mosligi * 0.2) +
                  (imkoniyat * 0.2) +
                  (obro' * 0.15) +
                  (afzalliklar * 0.15)
```
