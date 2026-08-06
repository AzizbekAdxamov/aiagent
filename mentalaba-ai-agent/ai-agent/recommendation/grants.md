# Tavsiya — Grantlar

## Ball berish omillari

| Omil | Og'irlik | Tavsif |
|------|----------|--------|
| Muvofiqlik mosligi | 30% | Foydalanuvchi mezonlarga javob beradi |
| Tur mosligi | 25% | To'liq vs qisman vs faqat to'lov |
| Muddati dolzarbligi | 20% | Yaqin muddatlar yuqoriroq ball |
| Miqdor | 15% | Yuqori miqdorlar yuqoriroq ball |
| Aloqadorlik | 10% | Foydalanuvchi sohasiga bog'liq |

## Algoritm

```python
def score_grant(grant, user_prefs):
    score = 0
    
    # Tur afzalligi
    if user_prefs.prefers_full and grant.type == 'full':
        score += 25
    elif grant.type == 'partial':
        score += 15
    
    # Muddati dolzarbligi (yaqinroq = yuqori)
    days_until_deadline = (grant.deadline - now).days
    if days_until_deadline < 30:
        score += 20
    elif days_until_deadline < 90:
        score += 15
    else:
        score += 10
    
    # Miqdor (agar ko'rsatilgan bo'lsa)
    if grant.amount:
        score += min(15, grant.amount / 100000 * 15)
    
    # Muvofiqlik mosligi
    if user_meets_criteria(user_prefs, grant.eligibility):
        score += 30
    
    return score
```

## Natija

Ball bo'yicha tartiblangan eng yaxshi grantlar, asos va muddat ma'lumoti bilan.
