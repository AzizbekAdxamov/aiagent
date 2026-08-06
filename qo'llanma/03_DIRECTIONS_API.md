# 03_DIRECTIONS_API.md

# Directions API

Bu modul Mentalaba AI Agent uchun universitetlarning barcha
yo'nalishlarini boshqaradi.

Har bir universitetda o'nlab yoki yuzlab yo'nalishlar mavjud.

AI foydalanuvchi savollarining katta qismiga aynan shu endpoint orqali
javob beradi.

---

# Base URL

https://api.mentalaba.uz/v1/directions

---

# Purpose

Direction — bu universitet ichidagi ta'lim yo'nalishi.

Masalan

PDP University

↓

Software Engineering

Cyber Security

Artificial Intelligence

Business Administration

Architecture

...

---

# Main Object

Direction Object

{
    id,

    university_id,

    slug,

    id_number,

    name_uz,
    name_ru,
    name_en,

    description_uz,
    description_ru,
    description_en,

    category_id,

    degree_ids[],

    contract_type_ids[],

    has_stipend,

    start_date,

    end_date,

    is_open_for_admission,

    is_study_transferable,

    transfer_start_date,

    transfer_end_date,

    requirement_uz,
    requirement_ru,
    requirement_en,

    has_mandatory_subjects,

    first_subject,

    second_subject,

    education_type_languages[],

    exam_subjects,

    contract_serial
}

---

# university_id

Direction qaysi universitetga tegishli.

Bu University API dagi id bilan bog'langan.

Example

37

↓

Jahon iqtisodiyoti va diplomatiya universiteti

---

# id_number

Ichki kod.

Misol

SE101

CS205

AI501

AI foydalanuvchiga faqat kerak bo'lsa ko'rsatadi.

---

# category_id

Yo'nalish kategoriyasi.

Masalan

Engineering

Medicine

Economics

Law

Business

Education

IT

Design

...

Lookup endpoint mavjud bo'lishi mumkin.

Agar bo'lmasa AI faqat ID ni saqlaydi.

---

# Degree

degree_ids

Lookup

GET

/v1/degrees

Known Values

1

Bachelor

2

Master

3

PhD

4

Transfer

AI javobi

"Bakalavr bosqichi."

yoki

"Magistratura dasturi."

---

# Contract Types

contract_type_ids

Bir yo'nalishda bir nechta kontrakt turi bo'lishi mumkin.

Masalan

Grant

Kontrakt

Super kontrakt

Kechiktirilgan to'lov

Installment

Future endpoint orqali lookup qilinadi.

---

# Scholarship

has_stipend

true

↓

Yo'nalishda stipendiya mavjud.

false

↓

Stipendiya mavjud emas.

---

# Admission Dates

start_date

end_date

AI

"Qabul davom etmoqda."

yoki

"Qabul tugagan."

---

# Study Transfer

is_study_transferable

true

↓

O'qishni ko'chirish mumkin.

false

↓

Transfer mavjud emas.

---

transfer_start_date

transfer_end_date

AI

Transfer muddatini foydalanuvchiga chiqaradi.

---

# Requirements

requirement_uz

requirement_ru

requirement_en

Masalan

IELTS

SAT

Milliy sertifikat

Ijodiy imtihon

Minimal GPA

...

AI ushbu matnni foydalanuvchiga tushunarli qilib chiqaradi.

---

# Mandatory Subjects

has_mandatory_subjects

true

↓

Majburiy fanlar mavjud.

---

first_subject

second_subject

Misol

Matematika

Fizika

Biologiya

Kimyo

Ingliz tili

Tarix

Huquq

...

---

# Exam Subjects

exam_subjects

{

first_subject_id

first_subject_name_uz

first_subject_name_ru

first_subject_name_en

second_subject_id

second_subject_name_uz

...

third_subject_id

...

}

AI

Fanlarni ro'yxat qilib beradi.

Masalan

Qabul fanlari:

• Matematika

• Fizika

• Ingliz tili

---

# Education Type Languages

Eng muhim obyekt.

education_type_languages[]

Har bir element

{

academic_year,

education_type_id,

education_language_id,

local_tuition_fee,

international_tuition_fee

}

---

# academic_year

Masalan

2026

2027

AI

Narx aynan qaysi yil uchun ekanligini ko'rsatadi.

---

# education_type_id

Lookup

GET

/v1/education-types

Known Values

1

Kunduzgi

2

Sirtqi

3

Kechki

4

Masofaviy

AI

"Kunduzgi ta'lim"

"Sirtqi ta'lim"

deb chiqaradi.

---

# education_language_id

Lookup

GET

/v1/education-languages

Known Values

1

O'zbek

2

English

3

Russian

4

Turkman

5

Qozoq

6

Qoraqalpoq

7

Qirg'iz

8

Tojik

9

Arab

10

Chinese

11

German

AI

Har doim nomini chiqaradi.

---

# Tuition Fee

local_tuition_fee

O'zbekiston fuqarolari uchun.

international_tuition_fee

Xorijiy fuqarolar uchun.

AI

Masalan

"Kunduzgi ingliz tili:

22 mln so'm."

---

# Slug

slug

SEO va URL uchun.

Misol

software-engineering

---

# AI Workflow

User

"PDP da AI yo'nalishi bormi?"

↓

University slug

↓

University detail

↓

Directions endpoint

↓

Filter

name contains "Artificial"

↓

Return

---

User

"Ingliz tilidagi magistratura"

↓

Directions

↓

degree = Master

↓

language = English

↓

Return

---

User

"Sirtqi IT"

↓

education_type

↓

Part Time

↓

Category

↓

Return

---

# AI Filters

University

Degree

Language

Education Type

Region

Contract Price

Transfer Available

Scholarship

Admission Open

Mandatory Subjects

Exam Subjects

Tuition Range

---

# Cache

Directions

24 hours

Education Types

30 days

Languages

30 days

Degrees

30 days

---

# Example Questions

PDP da AI bormi?

TATU dagi magistratura

IELTS talab qiladigan yo'nalishlar

Eng arzon IT yo'nalishi

Masofaviy ta'lim

Sirtqi iqtisod

Ingliz tilidagi bakalavr

Grantli magistratura

Transfer mumkin bo'lgan yo'nalishlar

SAT talab qiladigan yo'nalishlar

---

# Future Improvements

AI Recommendation

Career Match

Salary Prediction

University Similarity

Admission Probability

Scholarship Prediction

Roadmap Generator

Skill Recommendation

Learning Path

Vector Search

Semantic Search

LLM Ranking
