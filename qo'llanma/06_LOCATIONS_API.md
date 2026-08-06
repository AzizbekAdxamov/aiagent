# 06_LOOKUP_TABLES.md

# Lookup Tables

## Purpose

Mentalaba API ko'plab obyektlarni ID orqali saqlaydi.

Masalan

education_type_id

education_language_id

degree_id

institution_category_id

location_id

va boshqalar.

AI foydalanuvchiga hech qachon ID ko'rsatmaydi.

Har doim Lookup Service orqali ID ni nomga o'giradi.

---

# Lookup Service Architecture

User Question

↓

API Response

↓

Contains IDs

↓

Lookup Service

↓

Cache

↓

Human Readable Text

↓

LLM Response

---

# Lookup Endpoints

GET

/v1/institution-categories

GET

/v1/education-types

GET

/v1/education-languages

GET

/v1/degrees

GET

/v1/locations/regions

Future

/v1/subjects

/v1/contract-types

/v1/direction-categories

/v1/news-tags

---

# Institution Categories

Endpoint

GET

/institution-categories

Known Values

| ID | Uzbek | English |
|----|--------|----------|
|1|Maktab|School|
|2|Litsey|Lyceum|
|3|Texnikum|Technical School|
|4|Universitet|University|
|5|Kollej|College|
|6|Kasb-hunar maktabi|Vocational School|
|7|Boshqa|Other|
|8|Prezident maktabi|Presidential School|
|9|Temurbeklar maktabi|Temurbek School|

AI Rule

Do not show IDs.

Always show translated name.

---

# Education Types

Endpoint

GET

/education-types

Known Values

| ID | Uzbek | English |
|----|--------|----------|
|1|Kunduzgi|Full-time|
|2|Sirtqi|Part-time|
|3|Kechki|Evening|
|4|Masofaviy|Distance Learning|

AI Rule

education_type_id

↓

Readable Name

---

# Education Languages

Endpoint

GET

/education-languages

Known Values

| ID | Uzbek | English |
|----|--------|----------|
|1|O'zbek|Uzbek|
|2|Ingliz|English|
|3|Rus|Russian|
|4|Turkman|Turkmen|
|5|Qozoq|Kazakh|
|6|Qoraqalpoq|Karakalpak|
|7|Qirg'iz|Kyrgyz|
|8|Tojik|Tajik|
|9|Arab|Arabic|
|10|Xitoy|Chinese|
|11|Nemis|German|

Each language contains

id

name_uz

name_ru

name_en

code

---

AI Rule

Language should be displayed according to user language.

Example

education_language_id = 2

↓

English

---

# Degrees

Endpoint

GET

/degrees

Known Values

| ID | Uzbek | English |
|----|--------|----------|
|1|Bakalavr|Bachelor|
|2|Magistr|Master|
|3|Doktorantura|PhD|
|4|O'qishni ko'chirish|Transfer|

AI Rule

Never display degree IDs.

Always display readable degree name.

---

# Regions

Endpoint

GET

/locations/regions

Known Values

| ID | Region |
|----|--------|
|1|Qoraqalpog'iston Respublikasi|
|2|Andijon viloyati|
|3|Buxoro viloyati|
|4|Jizzax viloyati|
|5|Qashqadaryo viloyati|
|6|Navoiy viloyati|
|7|Namangan viloyati|
|8|Samarqand viloyati|
|9|Surxondaryo viloyati|
|10|Sirdaryo viloyati|
|11|Toshkent viloyati|
|12|Farg'ona viloyati|
|13|Xorazm viloyati|
|14|Toshkent shahri|
|15|Boshqa|

AI Rule

location_id

↓

Region Name

---

# Lookup Cache

Lookup data changes very rarely.

Recommended cache duration

Institution Categories

30 days

Education Types

30 days

Education Languages

30 days

Degrees

30 days

Regions

30 days

---

# Lookup Manager

The backend should have a centralized Lookup Manager.

Responsibilities

• Load lookup data

• Store in memory

• Cache responses

• Convert IDs to names

• Refresh cache automatically

• Handle missing IDs

---

# Missing Lookup Strategy

If an unknown ID is received

Example

education_type_id = 99

AI should respond

Unknown Education Type

and log the issue.

Never crash.

---

# Translation Strategy

Each lookup contains

Uzbek

Russian

English

The AI must return the value that matches the current interface language.

Example

Current Language

English

↓

Degree

Bachelor

Current Language

Uzbek

↓

Bakalavr

---

# API Usage Examples

Example

Response

{

education_type_id:1,

education_language_id:2,

degree_ids:[1]

}

↓

Lookup

1

↓

Full-time

2

↓

English

1

↓

Bachelor

↓

Final Answer

Bachelor

English

Full-time

---

# Future Lookup Modules

Subjects

Contract Types

Direction Categories

News Tags

Application Status

University Types

Grant Types

Certificate Types

Payment Types

Scholarship Types

Student Status

---

# Frontend Integration

Frontend should never hardcode lookup values.

Every dropdown

Every filter

Every badge

Every label

must be populated from Lookup API.

---

# AI Rules

Never expose numeric IDs.

Always convert IDs before generating responses.

Always cache lookup tables.

Always support multilingual values.

Always refresh lookup cache periodically.

Never duplicate lookup logic across services.

Use the centralized Lookup Manager for every conversion.
# 06_LOCATIONS_API.md

# Mentalaba AI Agent
## Locations API Documentation

---

# Overview

Locations moduli universitetlar, texnikumlar, litseylar va boshqa ta'lim muassasalarini geografik joylashuv bo'yicha filtrlash uchun ishlatiladi.

AI Agent ushbu API orqali:

- Viloyatlar ro'yxatini oladi
- Universitetning qaysi viloyatda joylashganini aniqlaydi
- Region bo'yicha universitetlarni filter qiladi
- Chat davomida foydalanuvchi joylashuviga qarab tavsiya beradi

---

# Base URL

```
https://api.mentalaba.uz/v1/locations
```

---

# Available Endpoints

## 1. GET /locations/regions

Barcha viloyatlar ro'yxatini qaytaradi.

### Request

```
GET
/v1/locations/regions
```

### Curl

```bash
curl -X GET \
https://api.mentalaba.uz/v1/locations/regions \
-H "accept: application/json"
```

---

# Response

```json
[
  {
    "id": 1,
    "name_uz": "Qoraqalpog‘iston Respublikasi",
    "name_ru": "Республика Каракалпакстан",
    "name_en": "Republic of Karakalpakstan."
  },
  {
    "id": 2,
    "name_uz": "Andijon viloyati",
    "name_ru": "Андижанская область",
    "name_en": "Andijan Region"
  },
  {
    "id": 3,
    "name_uz": "Buxoro viloyati",
    "name_ru": "Бухарская область",
    "name_en": "Bukhara Region"
  },
  {
    "id": 4,
    "name_uz": "Jizzax viloyati",
    "name_ru": "Джизакская область",
    "name_en": "Jizzakh Region"
  },
  {
    "id": 5,
    "name_uz": "Qashqadaryo viloyati",
    "name_ru": "Кашкадарьинская область",
    "name_en": "Kashkadarya Region"
  },
  {
    "id": 6,
    "name_uz": "Navoiy viloyati",
    "name_ru": "Навоийская область",
    "name_en": "Navoi Region"
  },
  {
    "id": 7,
    "name_uz": "Namangan viloyati",
    "name_ru": "Наманганская область",
    "name_en": "Namangan Region"
  },
  {
    "id": 8,
    "name_uz": "Samarqand viloyati",
    "name_ru": "Самаркандская область",
    "name_en": "Samarkand Region"
  },
  {
    "id": 9,
    "name_uz": "Surxondaryo viloyati",
    "name_ru": "Сурхандарьинская область",
    "name_en": "Surkhandarya Region"
  },
  {
    "id": 10,
    "name_uz": "Sirdaryo viloyati",
    "name_ru": "Сырдарьинская область",
    "name_en": "Syrdarya Region"
  },
  {
    "id": 11,
    "name_uz": "Toshkent viloyati",
    "name_ru": "Ташкентская область",
    "name_en": "Tashkent Region"
  },
  {
    "id": 12,
    "name_uz": "Farg'ona viloyati",
    "name_ru": "Ферганская область",
    "name_en": "Fergana Region"
  },
  {
    "id": 13,
    "name_uz": "Xorazm viloyati",
    "name_ru": "Хорезмская область",
    "name_en": "Khorezm Region"
  },
  {
    "id": 14,
    "name_uz": "Toshkent shahri",
    "name_ru": "Город Ташкент",
    "name_en": "Tashkent City"
  },
  {
    "id": 15,
    "name_uz": "Boshqa",
    "name_ru": "Другой",
    "name_en": "Other"
  }
]
```

---

# Region IDs

| ID | Uzbek | English |
|----|---------|----------|
|1|Qoraqalpog'iston Respublikasi|Republic of Karakalpakstan|
|2|Andijon|Andijan|
|3|Buxoro|Bukhara|
|4|Jizzax|Jizzakh|
|5|Qashqadaryo|Kashkadarya|
|6|Navoiy|Navoi|
|7|Namangan|Namangan|
|8|Samarqand|Samarkand|
|9|Surxondaryo|Surkhandarya|
|10|Sirdaryo|Syrdarya|
|11|Toshkent viloyati|Tashkent Region|
|12|Farg'ona|Fergana|
|13|Xorazm|Khorezm|
|14|Toshkent shahri|Tashkent City|
|15|Boshqa|Other|

---

# JSON Field Description

| Field | Type | Description |
|---------|------|-------------|
|id|number|Region ID|
|name_uz|string|Uzbek name|
|name_ru|string|Russian name|
|name_en|string|English name|

---

# Where This ID Is Used

Universities API ichida:

```json
{
  "location_id":14
}
```

Bu quyidagini anglatadi:

```
Toshkent shahri
```

---

# Agent Usage

AI Agent foydalanuvchi savolini region bo'yicha aniqlaydi.

Misollar:

> Toshkentdagi universitetlar

↓

location_id = 14

↓

Universitetlarni filter qilish.

---

> Samarqanddagi grantli universitetlar

↓

location_id = 8

↓

Grant API + University API

↓

Natija qaytariladi.

---

> Andijonda IT universitet bormi?

↓

Region = 2

↓

University Search

↓

Directions Search

↓

Natija

---

# Frontend Usage

Dropdown:

```
Viloyat tanlang

□ Andijon

□ Buxoro

□ Samarqand

□ Toshkent shahri

...
```

Search Filter:

```
Region

Degree

Grant

Contract

Language

Education Type
```

---

# AI Intent Examples

## User

```
Toshkentdagi universitetlarni ko'rsat
```

Intent

```
SearchUniversityByRegion
```

Parameters

```json
{
  "location_id":14
}
```

---

## User

```
Samarqanddagi grantlar
```

Intent

```
SearchGrantByRegion
```

Parameters

```json
{
  "location_id":8
}
```

---

## User

```
Farg'onadagi magistratura
```

Workflow

```
Region

↓

University

↓

Directions

↓

Degree = Master

↓

Result
```

---

# Agent Cache

Tavsiya etiladi:

```
TTL:

24 soat
```

Sababi:

Viloyatlar juda kam o'zgaradi.

---

# Local Storage

Frontend yuklanganda bir marta olinadi.

```
GET
/locations/regions
```

Natija:

```
Redux

yoki

React Query

yoki

Zustand
```

ga saqlanadi.

---

# AI Recommendation Logic

Misol:

```
User:

Men Toshkentdaman
```

Agent:

```
location_id = 14
```

Keyingi barcha universitet qidiruvlari default:

```
Toshkent shahri
```

bo'yicha amalga oshiriladi.

---

# Related APIs

Universities

```
GET /universities/filter
```

Universities

```
GET /universities/one/{slug}
```

University Grants

```
GET /university-grants/user-side
```

Directions

```
GET /directions
```

---

# Summary

Locations API Mentalaba AI Agent uchun asosiy geografik ma'lumotlar manbai hisoblanadi.

U quyidagilarni ta'minlaydi:

- Viloyatlar ro'yxati
- Region ID mapping
- Universitetlarni hudud bo'yicha filtrlash
- Grantlarni hudud bo'yicha izlash
- AI kontekstini foydalanuvchi joylashuviga moslashtirish
- Frontend dropdown va filterlarni to'ldirish