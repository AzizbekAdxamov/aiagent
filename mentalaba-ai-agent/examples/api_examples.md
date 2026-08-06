# Misollar — API Misollari

## Universitetlar ro'yxati

```bash
curl -H "Authorization: Bearer mb_sk_live_xxx" \
  "https://api.mentalaba.com/v1/universities?region_id=1&limit=3"
```

Javob:
```json
{
  "data": [
    {
      "id": "uni_001",
      "name": "Addis Ababa University",
      "region": "Addis Ababa",
      "type": "University",
      "student_count": 48000
    },
    {
      "id": "uni_002",
      "name": "AAU Institute of Technology",
      "region": "Addis Ababa",
      "type": "Institute"
    }
  ],
  "pagination": {
    "next_cursor": "...",
    "has_more": true,
    "total": 15
  }
}
```

## AI Agent bilan chat

```bash
curl -X POST -H "Authorization: Bearer mb_sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Menga Addis Ababadagi universitetlarni ko'rsat",
    "session_id": "sess_123"
  }' \
  "https://api.mentalaba.com/v1/chat"
```

Javob:
```json
{
  "session_id": "sess_123",
  "response": "Mana Addis Ababadagi universitetlar...",
  "cards": [...],
  "suggestions": [...]
}
```

## Tavsiyalar olish

```bash
curl -X POST -H "Authorization: Bearer mb_sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "preferences": {
      "region_id": 1,
      "degree_id": 4,
      "budget_max": 50000
    }
  }' \
  "https://api.mentalaba.com/v1/recommend"
```
