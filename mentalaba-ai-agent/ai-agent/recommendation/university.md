# Tavsiya — Universitet

## Ball berish omillari

| Omil | Og'irlik | Tavsif |
|------|----------|--------|
| Joylashuv mosligi | 25% | Foydalanuvchining afzal viloyati |
| Akademik takliflar | 20% | Yo'nalish mavjudligi |
| Obro' | 15% | Reyting, yoshi, talabalar soni |
| Imkoniyat | 20% | To'lov vs byudjet |
| Imkoniyatlar | 10% | Yotoqxona, kutubxona, laboratoriyalar |
| Til | 10% | O'qitish tili |

## Algoritm

```python
def score_university(university, user_prefs):
    score = 0
    
    # Joylashuv
    if university.region_id == user_prefs.region_id:
        score += 25
    
    # Imkoniyat
    if user_prefs.budget_max:
        min_tuition = get_min_tuition(university.id)
        if min_tuition <= user_prefs.budget_max:
            score += 20 * (1 - min_tuition / user_prefs.budget_max)
    
    # Imkoniyatlar
    if university.has_dormitory: score += 5
    if university.has_library: score += 2.5
    if university.has_lab: score += 2.5
    
    # Obro' (kattaroq/eskiroq = ko'proq obro'li)
    reputation_score = min(15, university.student_count / 10000 * 15)
    score += reputation_score
    
    return score
```

## Natija

Ball bo'yicha tartiblangan eng yaxshi N ta universitet, har bir tavsiya uchun asos bilan.
