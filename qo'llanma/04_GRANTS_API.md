# 04_GRANTS_API.md

# University Grants API

Bu modul universitet grantlari bilan ishlaydi.

AI foydalanuvchilarning grantga oid barcha savollariga aynan shu
endpoint orqali javob beradi.

---

# Base URL

https://api.mentalaba.uz/v1/university-grants

---

# Goal

AI quyidagilarni bajara olishi kerak.

• Universitet grantlarini ko'rsatish

• Grant tavsifini tushuntirish

• Grant shartlarini chiqarish

• Grant bor yoki yo'qligini aniqlash

• Qaysi universitetlarda grant mavjudligini topish

• Eng yaxshi grantlarni tavsiya qilish

• Grantlarni region bo'yicha filtrlash

• Grantlarni universitet bilan bog'lash

---

# Available Endpoints

GET

/university-grants/user-side

POST

/university-grants

---

# User Side Endpoint

GET

/university-grants/user-side?limit=20&offset=0

Bu AI foydalanadigan asosiy endpoint.

Response

{

entities:[...]

pageInfo:{}

}

---

# Grant Object

{

grant_image,

univer_name_uz,

univer_name_ru,

univer_name_en,

university_slug_name,

univer_logo,

region_name_uz,

region_name_ru,

region_name_en,

grant_title_uz,

grant_title_ru,

grant_title_en,

grant_desc_uz,

grant_desc_ru,

grant_desc_en,

created_at,

order,

status

}

---

# University Relation

Har bir grant

university_slug_name

orqali universitetga bog'langan.

Misol

{

"university_slug_name":"pdp-university"

}

AI

University API dagi slug bilan solishtiradi.

---

Workflow

User

"PDP grantlari"

↓

Slug API

↓

University Detail

↓

University Slug

↓

Grant Endpoint

↓

Filter

university_slug_name

↓

Return

---

# Grant Image

grant_image

Frontend Card ichida ishlatiladi.

AI faqat URL ni frontendga yuboradi.

---

# University Logo

univer_logo

Chat javobida ko'rsatish mumkin.

---

# Region

region_name_uz

AI

"Toshkent shahridagi grant."

deb yozadi.

---

# Title

grant_title_uz

Misol

500 ta grant

100% Scholarship

IELTS Scholarship

...

AI javobning sarlavhasi sifatida ishlatadi.

---

# Description

grant_desc_uz

Grantning to'liq shartlari.

AI description ni qisqartirib chiqaradi.

Masalan

Asosiy talablar

IELTS

SAT

Interview

Essay

GPA

...

---

# Status

status

active

↓

Grant ishlayapti.

inactive

↓

Ko'rsatilmaydi.

AI inactive grantlarni tavsiya qilmaydi.

---

# Order

order

Frontend sorting uchun.

AI odatda bunga tegmaydi.

---

# Created Date

created_at

Eng yangi grantlarni topishda ishlatiladi.

---

# Pagination

pageInfo

{

currentCount,

totalCount,

offset,

limit

}

AI ko'p grant bo'lsa pagination ishlatadi.

---

# Search Strategy

User

"Grant bor universitetlar"

↓

GET

/university-grants/user-side

↓

Unique university_slug_name

↓

University API

↓

Return

---

User

"100 foiz grant"

↓

Search

grant_desc

grant_title

↓

Return

---

User

"IELTS grant"

↓

Search

grant_desc

↓

IELTS

↓

Return

---

# AI Summary

AI description ni qisqa qiladi.

Misol

Original

800 ta so'z

↓

Response

• IELTS 7+

• Interview

• Essay

• GPA

• 4 yil grant

---

# AI Filters

University

Region

Grant Status

Grant Title

Description

Created Date

Newest

Oldest

---

# AI Questions

PDP grantlari

Grant bor universitetlar

100 foiz grant

IELTS grant

SAT grant

Xususiy universitet grantlari

Davlat grantlari

Toshkent grantlari

Samarqand grantlari

Eng katta grant

Yangi grantlar

---

# Recommendation Logic

Agar foydalanuvchi

AI

IT

Computer Science

desa

AI

IT universitetlari grantlarini birinchi chiqaradi.

---

Medicine

↓

Medical grant

---

Law

↓

Law grant

---

Economics

↓

Business grant

---

# Future Features

Scholarship Ranking

Grant Deadline

Grant Reminder

Scholarship Calculator

AI Matching

Scholarship Probability

Scholarship Notification

Auto Recommendation

Favorite Grants

Grant Compare

---

# Cache

Grant List

5 minutes

Grant Detail

10 minutes

University Relation

30 minutes

---

# Error Handling

404

Grant topilmadi.

↓

AI

"Hozircha ushbu universitet uchun faol grant topilmadi."

---

Empty Array

↓

AI

"Faol grant mavjud emas."

---

500

↓

Retry

↓

Fallback

↓

Error Message

---

# Frontend Components

Grant Card

Grant Detail

Grant Badge

Grant Filter

Grant Search

Grant Carousel

Grant Recommendation

Grant Timeline
