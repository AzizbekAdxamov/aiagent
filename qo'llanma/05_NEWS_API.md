# 05_NEWS_API.md

# News API

Mentalaba AI Agent yangiliklar modulini boshqaradi.

Bu modul universitetlar, grantlar, admission va platformaga oid
yangiliklarni foydalanuvchiga yetkazadi.

---

# Base URL

https://api.mentalaba.uz/v1/news

---

# Purpose

AI quyidagilarni bajaradi.

• Universitet yangiliklarini ko'rsatish

• Grant yangiliklarini chiqarish

• Admission e'lonlarini ko'rsatish

• Universitet eventlarini chiqarish

• Oxirgi yangiliklarni saralash

• Universitetga bog'liq yangiliklarni topish

---

# Available Endpoint

POST

/news

(GET endpoint mavjud bo'lsa keyinchalik qo'shiladi.)

---

# News Object

{

id,

related_to,

relation_id,

header_image,

title_uz,

title_ru,

title_en,

description_uz,

description_ru,

description_en,

status,

views_count,

tag_ids[],

mtdt_title_uz,

mtdt_title_ru,

mtdt_title_en,

mtdt_description_uz,

mtdt_description_ru,

mtdt_description_en,

mtdt_keywords_uz,

mtdt_keywords_ru,

mtdt_keywords_en

}

---

# related_to

Yangilik qaysi obyektga tegishli.

Misol

university

grant

direction

event

news

platform

future values...

---

# relation_id

Bog'langan obyekt ID si.

Masalan

related_to

↓

university

relation_id

↓

37

AI

University API orqali

id = 37

universitetini topadi.

---

# Title

title_uz

Yangilik sarlavhasi.

AI Chat javobida Heading sifatida ishlatiladi.

---

# Description

description_uz

Yangilikning to'liq matni.

AI kerak bo'lsa summary qiladi.

Masalan

Original

900 words

↓

AI

5-6 ta asosiy punkt chiqaradi.

---

# Header Image

header_image

Frontend News Card ichida ishlatiladi.

AI faqat URL qaytaradi.

---

# Status

active

↓

Ko'rsatish mumkin.

inactive

↓

AI chiqarishi mumkin emas.

---

# Views Count

views_count

Yangilik nechta ko'rilganini bildiradi.

AI odatda ishlatmaydi.

Future recommendation uchun foydali.

---

# Tags

tag_ids[]

Tag API orqali lookup qilinadi.

Misol

Grant

Admission

Scholarship

IT

Medicine

Law

Competition

Conference

AI

Tag orqali filter qiladi.

---

# Metadata

SEO uchun.

AI ishlatmaydi.

Lekin Search Engine uchun saqlanadi.

---

# AI Workflow

User

"PDP yangiliklari"

↓

University API

↓

University ID

↓

News

↓

related_to == university

relation_id == university.id

↓

Return

---

User

"Grant yangiliklari"

↓

News

↓

Tags

↓

Grant

↓

Return

---

User

"Bugungi yangiliklar"

↓

Sort

Created Date DESC

↓

Return

---

# AI Search

University Name

↓

University ID

↓

Relation ID

↓

News

↓

Summary

---

# AI Summary

Original

500 words

↓

Summary

• Asosiy voqea

• Muhim sana

• Kim uchun

• Qanday qatnashish

---

# AI Filters

University

Region

Tag

Newest

Popular

Grant

Admission

Conference

Scholarship

Competition

---

# Future Features

News Recommendation

Trending News

Daily Digest

Personalized Feed

Push Notification

AI Summary

Voice Summary

News Translation

Bookmark

---

# Cache

News List

5 min

University News

5 min

Trending

10 min

Tags

24h

---

# Error Handling

404

Yangilik topilmadi.

↓

AI

"Bu universitet uchun hozircha yangilik mavjud emas."

---

500

↓

Retry

↓

Fallback

---

# Frontend Components

News Card

News Detail

Related News

News Search

Trending

Tag Filter

Bookmark
