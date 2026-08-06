# Navigatsiya — Sahifa marshrutlari

## Frontend marshrutlari

| Marshrut | Sahifa | Tavsif |
|----------|--------|--------|
| `/` | Bosh sahifa | Chat interfeysi bilan boshqaruv paneli |
| `/universities` | Universitetlar ro'yxati | Barcha universitetlarni ko'rish |
| `/universities/[slug]` | Universitet tafsiloti | Universitet profili |
| `/directions` | Yo'nalishlar ro'yxati | Barcha yo'nalishlarni ko'rish |
| `/directions/[id]` | Yo'nalish tafsiloti | Yo'nalish tafsilotlari |
| `/grants` | Grantlar ro'yxati | Stipendiyalarni ko'rish |
| `/grants/[id]` | Grant tafsiloti | Grant tafsilotlari |
| `/news` | Yangiliklar ro'yxati | Ta'lim yangiliklari |
| `/news/[slug]` | Yangilik maqolasi | To'liq maqola |
| `/saved` | Saqlangan elementlar | Foydalanuvchi xatcho'plari |
| `/compare` | Taqqoslash | Yonma-yon taqqoslash |
| `/settings` | Sozlamalar | Foydalanuvchi afzalliklari |

## API marshrutlari

| Marshrut | Method | Tavsif |
|----------|--------|--------|
| `/api/v1/chat` | POST | Chat xabarini yuborish |
| `/api/v1/chat/stream` | POST | Chat javobini oqimlash |
| `/api/v1/sessions` | POST | Sessiya yaratish |
| `/api/v1/sessions/:id` | GET | Sessiyani olish |
| `/api/v1/recommend` | POST | Tavsiyalar olish |
