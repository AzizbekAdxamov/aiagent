# API haqida umumiy ma'lumot

## Bazaviy URL

```
https://api.mentalaba.com/v1
```

## Autentifikatsiya

Barcha API so'rovlari `Authorization` sarlavhasi orqali API kalitini talab qiladi:

```
Authorization: Bearer <api_key>
```

## Kontent turi

Barcha so'rov va javoblar `application/json` ishlatadi.

## Versiyalash

API URL yo'li orqali versiyalanadi: `/v1/`, `/v2/`, va boshqalar.

## Asosiy endpointlar

| Method | Endpoint | Tavsif |
|--------|----------|--------|
| GET | `/universities` | Barcha universitetlar ro'yxati |
| GET | `/universities/:id` | Universitet tafsilotlari |
| GET | `/universities/:id/gallery` | Universitet galereyasi |
| GET | `/universities/:id/directions` | Universitet yo'nalishlari |
| GET | `/universities/:id/grants` | Universitet grantlari |
| GET | `/directions` | Barcha yo'nalishlar ro'yxati |
| GET | `/directions/:id` | Yo'nalish tafsilotlari |
| GET | `/grants` | Barcha grantlar ro'yxati |
| GET | `/grants/:id` | Grant tafsilotlari |
| GET | `/news` | Yangiliklar ro'yxati |
| GET | `/news/:id` | Yangilik maqolasi |
| POST | `/chat` | AI agentga xabar yuborish |
| POST | `/recommend` | AI tavsiyalarini olish |
