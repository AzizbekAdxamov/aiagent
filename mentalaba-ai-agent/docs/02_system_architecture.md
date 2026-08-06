# Tizim arxitekturasi

## Yuqori darajadagi arxitektura

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend qatlami                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Chat   │  │  Kartalar│  │ Yanpanel │  │  FAB     │   │
│  │  Interfeys│  │          │  │          │  │          │   │
│  └────┬─────┘  └──────────┘  └──────────┘  └──────────┘   │
└───────┼─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway qatlami                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            REST API / WebSocket Endpointlar           │   │
│  └──────────────────────┬───────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      AI Agent qatlami                         │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │Intent   │  │  Vosita  │  │  Prompt  │  │  Kontekst  │  │
│  │Router   │  │  Router  │  │  Boshq.  │  │  Boshq.    │  │
│  └────┬────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘  │
│       └────────────┴─────────────┴───────────────┘         │
│                          │                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              LLM Xizmati (OpenAI/etc.)               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend xizmat qatlami                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Universi- │  │Yo'nalish │  │  Grant   │  │ Yangilik │   │
│  │tet Xiz.  │  │ Xizmati  │  │ Xizmati  │  │ Xizmati  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       └─────────────┴─────────────┴──────────────┘         │
│                          │                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  Kesh    │  │  Qidiruv │  │  Loglash │                  │
│  │  Qatlami │  │  Mexan.  │  │          │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Ma'lumot qatlami                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Ma'lumotlar bazasi (PostgreSQL)          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Asosiy komponentlar

1. **Frontend qatlami** - Responsiv dizayn bilan React/Next.js SPA
2. **API Gateway** - Autentifikatsiya bilan RESTful API endpointlar
3. **AI Agent qatlami** - Intentsiyalarni tasniflash, vosita marshrutlash, LLM integratsiyasi
4. **Backend xizmatlari** - Domenga oid biznes mantiq
5. **Ma'lumot qatlami** - Relyatsion sxema bilan PostgreSQL ma'lumotlar bazasi

## Dizayn tamoyillari

- Vazifalarning aniq ajratilishi bilan modulli arxitektura
- Samaradorlikni optimallashtirish uchun keshlash
- Masshtablanadigan mikroservislar uslubidagi backend
- Xatolarga chidamli, izchil pasayish bilan
- Har bir qatlamda loglash va monitoring
