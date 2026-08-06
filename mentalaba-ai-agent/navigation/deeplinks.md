# Navigatsiya — Chuqur havolalar

## Maqsad

Chuqur havolalar tashqi manbalardan ma'lum kontentga to'g'ridan-to'g'ri navigatsiyani ta'minlaydi.

## Havola formati

```
mentalaba://[entity_type]/[entity_id_or_slug]
```

## Qo'llab-quvvatlanadigan chuqur havolalar

| Chuqur havola | Yo'naltiradi | Misol |
|--------------|-------------|---------|
| `universities/[slug]` | Universitet tafsilot sahifasi | `universities/addis-ababa-university` |
| `directions/[id]` | Yo'nalish tafsilot sahifasi | `directions/dir_001` |
| `grants/[id]` | Grant tafsilot sahifasi | `grants/grant_001` |
| `news/[slug]` | Yangilik maqola sahifasi | `news/scholarship-2026` |
| `chat?q=[query]` | Oldindan to'ldirilgan so'rov bilan chat | `chat?q=universitetlarni+toping` |
| `recommend?prefs=...` | Afzalliklar bilan tavsiyalar | `recommend?prefs=adama` |

## Veb URL'lar

Chuqur havolalar veb URL sifatida ham ishlaydi:
- `https://mentalaba.com/go/universities/addis-ababa-university`

## QR kodlar

Quyidagilar uchun yaratilgan QR kodlar:
- Universitet profillari
- Grant tafsilotlari
- Chat kirish nuqtalari
- Tadbir reklamalari
