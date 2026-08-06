# Grantlar — Yaratish

## Yaratish endpointi

```
POST /api/v1/grants
```

## So'rov tanasi

```json
{
  "title": "AAU Merit Scholarship",
  "title_am": "አአዩ የብቃት ስኮላርሺፕ",
  "description": "To'lov va yashash xarajatlarini qoplaydigan to'liq stipendiya...",
  "description_am": "የትምህርት ክፍያ እና የኑሮ ወጪን የሚሸፍን ሙሉ ስኮላርሺፕ...",
  "type": "full",
  "provider": "Addis Ababa University",
  "provider_am": "አዲስ አበባ ዩኒቨርሲቲ",
  "amount": null,
  "currency": "ETB",
  "application_deadline": "2026-09-15",
  "eligibility_criteria": "3.5+ GPA ga ega talabalar uchun ochiq...",
  "eligibility_criteria_am": "3.5 እና ከዚያ በላይ GPA ላላቸው ተማሪዎች ክፍት...",
  "required_documents": [
    "Akademik transkript",
    "Tavsiya xati",
    "Shaxsiy bayonot"
  ],
  "university_id": "uni_123",
  "direction_ids": ["dir_001", "dir_002"]
}
```

## Tekshirish qoidalari

- `title` majburiy, maks 255 belgi
- `type` quyidagilardan biri bo'lishi kerak: full, partial, tuition_only, living_expenses
- `application_deadline` kelajakdagi sana bo'lishi kerak
- `university_id` yoki `direction_ids` dan kamida bittasi kerak
