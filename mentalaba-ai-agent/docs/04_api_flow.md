# API jarayoni

## So'rov hayot aylanishi

```
Foydalanuvchi ──▶ Chat Interfeysi ──▶ API Gateway ──▶ Intentsiya Router
                                                          │
                                                    ┌─────┴─────┐
                                                    │  Intent   │
                                                    │  Moslik?  │
                                                    └─────┬─────┘
                                                     Ha    Yo'q
                                                      │      │
                                                      ▼      ▼
                                                 Vosita Router  LLM Zaxira
                                                      │
                                                      ▼
                                               ┌──────────┐
                                               │  Vositani │
                                               │  Bajarish │
                                               └────┬─────┘
                                                    │
                                                    ▼
                                              ┌──────────┐
                                              │  Javobni  │
                                              │  Shakll.  │
                                              └────┬─────┘
                                                   │
                                                   ▼
                                              Foydalanuvchi
                                              Javob oladi
```

## Intentsiyalarni marshrutlash

| Intentsiya | Router | Vosita |
|------------|--------|--------|
| university_search | UniversityRouter | search_university, get_university |
| direction_search | DirectionRouter | search_direction |
| grant_search | GrantRouter | search_grants |
| comparison | ComparisonRouter | compare_universities |
| admission | AdmissionRouter | get_university (qabul ma'lumoti) |
| transfer | TransferRouter | search_direction (transfer ma'lumoti) |
| faq | Fallback | LLM tomonidan yaratilgan javob |

## API Endpointlar

- `GET /api/v1/universities` — Universitetlar ro'yxati
- `GET /api/v1/universities/:id` — Universitet tafsilotlari
- `GET /api/v1/directions` — Yo'nalishlar ro'yxati
- `GET /api/v1/directions/:id` — Yo'nalish tafsilotlari
- `GET /api/v1/grants` — Grantlar ro'yxati
- `GET /api/v1/grants/:id` — Grant tafsilotlari
- `GET /api/v1/news` — Yangiliklar ro'yxati
- `GET /api/v1/news/:id` — Yangilik tafsilotlari
- `POST /api/v1/chat` — AI agentga xabar yuborish
- `POST /api/v1/recommend` — Tavsiyalar olish
