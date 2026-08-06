# Backend — Intentsiya Routeri

## Maqsad

Foydalanuvchi xabarlarini intentsiyalarga tasniflaydi va tegishli ishlovchilarga yo'naltiradi.

## Intentsiyalarni tasniflash

### Usul: LLM asosidagi tasniflash
LLM foydalanuvchi xabarlarini oldindan belgilangan intentsiyalarga ishonch balli bilan tasniflaydi.

### Intentsiya kategoriyalari

| Intentsiya | Tavsif | Handler |
|------------|--------|---------|
| `university_search` | Universitetlarni topish/qidirish | search_university / get_university |
| `direction_search` | Akademik dasturlarni topish | search_direction |
| `grant_search` | Stipendiyalarni topish | search_grants |
| `news_search` | Ta'lim yangiliklarini topish | search_news |
| `comparison` | Ob'ektlarni taqqoslash | compare_universities |
| `admission` | Qabul ma'lumoti | get_university (admission) |
| `transfer` | Transfer ma'lumoti | search_direction (transfer) |
| `faq` | Umumiy savollar | LLM to'g'ridan-to'g'ri javob |
| `recommendation` | Shaxsiylashtirilgan takliflar | recommend |
| `navigation` | Platformada navigatsiya | navigation |

### Ishonch chegaralari

- **Yuqori**: ≥ 0.8 — To'g'ridan-to'g'ri yo'naltirish
- **O'rta**: 0.5 - 0.8 — Aniqlashtirish varianti bilan yo'naltirish
- **Past**: < 0.5 — Aniqlashtirishga zaxira

## Router mantig'i

```python
def route_intent(message):
    intent, confidence = classify_intent(message)
    
    if confidence >= 0.8:
        return execute_intent(intent)
    elif confidence >= 0.5:
        result = execute_intent(intent)
        result.add_clarification(
            "Siz {intent_desc} ni qidirmoqchi edingizmi?"
        )
        return result
    else:
        return fallback_handler(message)
```
