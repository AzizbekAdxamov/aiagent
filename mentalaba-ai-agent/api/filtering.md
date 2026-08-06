# Filtrlash

## So'rov parametrlari bilan filtrlash

Ro'yxat endpointlari so'rov parametrlari orqali filtrlashni qo'llab-quvvatlaydi.

## Qo'llab-quvvatlanadigan filtrlar

### Universitetlar

| Filtr | Tur | Misol |
|-------|-----|-------|
| `region_id` | integer | `region_id=1` |
| `institution_type_id` | integer | `institution_type_id=2` |
| `category_id` | integer | `category_id=1` |
| `search` | string | `search=addis+ababa` |

### Yo'nalishlar

| Filtr | Tur | Misol |
|-------|-----|-------|
| `university_id` | integer | `university_id=5` |
| `education_type_id` | integer | `education_type_id=1` |
| `degree_id` | integer | `degree_id=1` |
| `contract_type_id` | integer | `contract_type_id=1` |
| `language_id` | integer | `language_id=1` |
| `search` | string | `search=computer+science` |

### Grantlar

| Filtr | Tur | Misol |
|-------|-----|-------|
| `university_id` | integer | `university_id=5` |
| `direction_id` | integer | `direction_id=10` |
| `grant_type` | string | `grant_type=full` |
| `search` | string | `search=merit` |

## Filtrlarni birlashtirish

Filtrlar `&` yordamida birlashtirilishi mumkin:

```
GET /api/v1/directions?university_id=5&degree_id=1&language_id=1
```
