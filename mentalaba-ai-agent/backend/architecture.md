# Backend — Arxitektura

## Umumiy ma'lumot

Backend vazifalarning aniq ajratilishi bilan modulli xizmat arxitekturasi sifatida tashkil etilgan.

## Qatlam tuzilishi

```
API qatlami (routes/controllers)
    │
    ▼
Xizmat qatlami (biznes mantiq)
    │
    ▼
Ma'lumotga kirish qatlami (repositories)
    │
    ▼
Ma'lumotlar bazasi (PostgreSQL)
```

## Xizmat modullari

| Modul | Mas'uliyat |
|--------|---------------|
| **api_service** | HTTP so'rovlarini qayta ishlash, marshrutlash |
| **tool_router** | AI vosita chaqiruvlarini marshrutlash va bajarish |
| **intent_router** | Foydalanuvchi intentsiyasini tasniflash va marshrutlash |
| **llm_service** | LLM API integratsiyasi |
| **cache** | Keshlash qatlami (Redis) |
| **search** | To'liq matnli qidiruv mexanizmi |
| **recommendation** | Tavsiya algoritmlari |
| **session** | Sessiya va kontekst boshqaruvi |
| **logging** | Loglash va monitoring |
