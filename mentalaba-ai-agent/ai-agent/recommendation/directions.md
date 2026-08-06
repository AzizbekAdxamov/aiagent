# Tavsiya — Yo'nalishlar

## Ball berish omillari

| Omil | Og'irlik | Tavsif |
|------|----------|--------|
| Fan mosligi | 30% | Foydalanuvchining kuchli tomonlari talablarga mos keladi |
| Karyera istiqbollari | 25% | Ish bozori talabi |
| Qiziqish mosligi | 20% | Foydalanuvchining aytilgan soha qiziqishlari |
| Foydalanish imkoniyati | 15% | Afzal universitetlarda mavjud |
| Davomiylik | 10% | Afzal o'qish davomiyligi |

## Algoritm

```python
def score_direction(direction, user_prefs, exam_scores):
    score = 0
    
    # Fan mosligi
    required_subjects = get_required_subjects(direction.id)
    subject_match = 0
    for subject in required_subjects:
        if subject.id in exam_scores and exam_scores[subject.id] >= subject.min_grade:
            subject_match += 1
    score += 30 * (subject_match / len(required_subjects))
    
    # Qiziqish mosligi
    if user_prefs.interest_category == direction.category_id:
        score += 20
    
    # Karyera istiqbollari
    demand_score = get_demand_score(direction.id)
    score += 25 * demand_score
    
    return score
```

## Natija

Ball bo'yicha tartiblangan eng yaxshi yo'nalishlar, asos bilan.
