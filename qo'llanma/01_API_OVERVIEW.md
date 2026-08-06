# Mentalaba AI Agent
# API Overview

Version: v1

Base URL

https://api.mentalaba.uz/v1

Authentication

Bearer Token

Authorization: Bearer <JWT>

Swagger

https://api.mentalaba.uz/docs

---

# Goal

Mentalaba AI Agent barcha ma'lumotlarni faqat Mentalaba API orqali oladi.

AI hech qanday scraping qilmaydi.

Barcha javoblar API orqali olinadi.

---

# API Categories

Universities

Directions

Education Types

Education Languages

Degrees

Grants

News

Locations

Tags

Search

Admission

Favorites

Applications

Users

Authentication

Chat History

AI Logs

---

# API Rules

AI Agent hech qachon database bilan to'g'ridan-to'g'ri ishlamaydi.

Har doim API ishlatiladi.

Har bir endpoint uchun:

Request

Response

Possible Errors

Pagination

Caching

belgilab chiqiladi.

---

# Common Response

Success

{
    "success": true,
    "data": ...
}

or

{
    ...
}

---

Error

{
    "statusCode":401,
    "message":"Unauthorized"
}

404

{
    "statusCode":404,
    "message":"Not Found"
}

500

{
    "statusCode":500,
    "message":"Internal Server Error"
}

---

Pagination

Ko'p endpointlarda:

limit

offset

ishlatiladi.

Misol

GET

/universities?limit=20&offset=0

Response

pageInfo

currentCount

totalCount

limit

offset

---

AI Cache

University list
24 hours

Directions
24 hours

Languages
7 days

Degrees
30 days

Regions
30 days

News
5 minutes

Grant
5 minutes

University Detail
30 minutes

---

AI Workflow

User Question

↓

Intent Detection

↓

Endpoint Selection

↓

API Call

↓

JSON Parsing

↓

LLM Response

↓

Chat UI

---

Example

User

"PDP universitetida grant bormi?"

↓

AI

GET

/universities/get-university-slug/PDP

↓

GET

/universities/one/pdp-university

↓

GET

/ university-grants/user-side

↓

Filter

university_slug_name == pdp-university

↓

Generate Answer

---

Example

User

"Toshkentdagi xususiy universitetlar"

↓

GET

/universities

↓

Filter

institution_category_id

↓

location_id

↓

Generate

---

Never

AI hech qachon

guess

hallucinate

fake information

qilmaydi.

Agar API da yo'q bo'lsa

"I couldn't find this information."

deb javob beradi.

---

Future APIs

Notification

Application Status

Scholarship Recommendation

AI Recommendation

Saved Universities

Student Profile

Agent Memory
