# Universitetlar — Grantlar

## Umumiy ma'lumot

Har bir universitet turli grant/stipendiya dasturlarini taklif qilishi yoki ularda qatnashishi mumkin. Ushbu modul universitetlar va grantlar o'rtasidagi munosabatni boshqaradi.

## Endpoint

```
GET /api/v1/universities/:id/grants
```

## Javob formati

```json
{
  "data": [
    {
      "id": "grant_001",
      "title": "AAU Merit Scholarship",
      "title_am": "አአዩ የብቃት ስኮላርሺፕ",
      "type": "full",
      "description": "Eng yaxshi talabalar uchun to'liq stipendiya...",
      "application_deadline": "2026-09-15"
    }
  ]
}
```

## Tegishli

To'liq grant hujjatlari uchun [Grantlar moduli](../grants/overview.md) ga qarang.
