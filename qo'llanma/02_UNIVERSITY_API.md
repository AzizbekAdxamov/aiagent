# 02_UNIVERSITY_API.md

# Universities API

Bu modul Mentalaba AI Agent uchun barcha universitet ma'lumotlarini boshqaradi.

---

# Base URL

https://api.mentalaba.uz/v1/universities

---

# Main Purpose

AI quyidagi savollarga javob bera olishi kerak:

- Universitet haqida ma'lumot
- Davlat yoki xususiyligini aniqlash
- Grant mavjudmi
- Kontrakt narxi
- Yo'nalishlari
- Ta'lim tillari
- Ta'lim shakllari
- Qabul ochiqmi
- Joylashuvi
- Telefon
- Website
- Social media
- Qabul muddati
- Talabalar soni
- Yotoqxona mavjudligi
- O'qishni ko'chirish imkoniyati
- Partner universitetmi

---

# University Object

API quyidagi asosiy obyektni qaytaradi.

{
    id,
    slug,

    full_name_uz,
    full_name_ru,
    full_name_en,

    abbr_name_uz,
    abbr_name_ru,
    abbr_name_en,

    description_uz,
    description_ru,
    description_en,

    logo,

    institution_category_id,

    institution_type,

    location_id,

    phone,

    email,

    website,

    support_email,

    domain,

    founded_year,

    students_count,

    minimal_tuition_fee,

    maximal_tuition_fee,

    address_uz,
    address_ru,
    address_en,

    latitude,
    longitude,

    admission_phone,

    admission_start_date,

    admission_deadline,

    current_quota,

    lead_limit,

    response_time,

    has_accomodation,

    has_grant,

    is_partner,

    is_open_for_admission,

    is_banned,

    representative_full_name,

    certification_link,

    accreditation_certificate,

    gallery[]
}

---

# institution_category_id

Bu maydon ta'lim muassasasi turini bildiradi.

| id | Type |
|----|------|
|1|Maktab|
|2|Litsey|
|3|Texnikum|
|4|Universitet|
|5|Kollej|
|6|Kasb-hunar maktabi|
|7|Boshqa|
|8|Prezident maktabi|
|9|Temurbeklar maktabi|

AI javoblarda ID ni emas, nomini chiqaradi.

Misol

institution_category_id = 4

↓

Universitet

---

# institution_type

Hozircha barcha universitetlarda

university

qiymati uchradi.

Future:

college

school

academy

institute

bo'lishi mumkin.

AI bu maydonga moslashuvchan bo'lishi kerak.

---

# location_id

Region ID.

Lookup

GET

/v1/locations/regions

Misol

14

↓

Toshkent shahri

2

↓

Andijon

8

↓

Samarqand

AI har doim Region nomini ko'rsatadi.

---

# founded_year

Universitet tashkil topgan sana.

Example

2019

---

# students_count

Talabalar soni.

Misol

15000

AI

"Universitetda taxminan 15 ming talaba tahsil oladi."

---

# Tuition

minimal_tuition_fee

maximal_tuition_fee

AI narxlarni diapazon ko'rinishida chiqaradi.

Misol

18 mln — 34 mln so'm

---

# Admission

admission_start_date

admission_deadline

is_open_for_admission

AI

"Hozir qabul ochiq."

yoki

"Qabul yakunlangan."

---

# Contact

phone

admission_phone

email

support_email

website

---

# Address

address_uz

latitude

longitude

AI xarita havolasi yaratishi mumkin.

https://maps.google.com/?q={lat},{lng}

---

# Social

instagram_username

telegram_username

facebook_username

linkedin_username

youtube_username

AI kerak bo'lsa foydalanuvchiga ijtimoiy tarmoqlarni ham ko'rsatadi.

---

# Flags

has_grant

Grant mavjud.

has_accomodation

Yotoqxona mavjud.

is_partner

Mentalaba partner universiteti.

is_banned

Platformada bloklangan.

AI foydalanuvchiga bloklangan universitetni tavsiya qilmaydi.

---

# Gallery

gallery[]

Universitet rasmlari.

Frontend Carousel ishlatadi.

---

# Endpoints

## Get University By Slug

GET

/universities/get-university-slug/{name}

Example

PDP

↓

{
    "slug":"pdp-university"
}

Workflow

User

"PDP"

↓

Slug API

↓

University Detail API

---

## Get University Detail

GET

/one/{slug}

Returns

Full University Object

Example

GET

/one/pdp-university

---

## User Side

GET

/user-side/{id}

Frontend uchun optimallashtirilgan endpoint.

AI imkon qadar shu endpointdan foydalanishi tavsiya etiladi.

---

# AI Search Strategy

Agar foydalanuvchi:

"PDP"

desa

1.

Slug topiladi

↓

2.

University Detail olinadi

↓

3.

Directions olinadi

↓

4.

Grant tekshiriladi

↓

5.

AI javob yaratadi.

---

# AI Filtering

Davlat universitetlari

Private universitetlar

Grant bor

Grant yo'q

Yotoqxona bor

Qabul ochiq

Region

Kontrakt narxi

Partner

Bularning barchasi client tarafida filter qilinishi mumkin.

---

# Cache

University List

24h

University Detail

30 min

Gallery

24h

Location

30d

---

# Possible AI Questions

PDP haqida ma'lumot

Toshkentdagi universitetlar

Davlat universitetlari

Xususiy universitetlar

Grantli universitetlar

Yotoqxonali universitetlar

IELTS talab qiladigan universitetlar

Qabul ochiq universitetlar

Kontrakti eng arzon universitet

IT universitetlari

Partner universitetlar

---

# Future Improvement

Search by AI Embedding

Semantic Search

Vector Database

University Recommendation

Similarity Search

AI Ranking

Personal Recommendation

Scholarship Prediction

Admission Chance Estimation
