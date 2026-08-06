# Tavsiya — Reyting

## Umumiy ma'lumot

Barcha tavsiya ballarini birlashtirgan yakuniy reyting algoritmi.

## Birlashtirilgan ball

```python
def get_combined_recommendation(user_prefs, exam_scores):
    universities = score_universities(user_prefs)
    directions = score_directions(user_prefs, exam_scores)
    grants = score_grants(user_prefs)
    
    return {
        "top_universities": universities[:5],
        "top_directions": directions[:5],
        "top_grants": grants[:5],
        "summary": generate_summary(
            universities[:3],
            directions[:3],
            grants[:3]
        )
    }
```

## Xulosa yaratish

Tavsiya xulosasi quyidagilarni o'z ichiga oladi:
1. Eng yaxshi umumiy universitet mosligi
2. Eng yaxshi yo'nalish mosligi, asos bilan
3. Tavsiya etilgan yo'l uchun mavjud grantlar
4. Amalga oshiriladigan keyingi qadamlar

## Ko'rsatish formati

Tavsiyalar quyidagicha ko'rsatiladi:
- **Eng yaxshi tanlov** — Eng yaxshi umumiy moslik
- **Alternativ variantlar** — Keyingi eng yaxshi tanlovlar
- **Tushuntirish** — Nima uchun bular tavsiya etildi
- **Harakat** — Foydalanuvchi keyin nima qilishi mumkin
