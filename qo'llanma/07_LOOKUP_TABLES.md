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
