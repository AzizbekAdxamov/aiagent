# 07_AI_AGENT_ARCHITECTURE.md

# Mentalaba AI Agent Architecture

Version: 1.0

---

# Overview

Mentalaba AI Agent — bu oddiy chatbot emas.

Bu **Tool Calling**, **RAG**, **Conversation Memory**, **Intent Detection** va **Mentalaba API** larni birlashtirgan AI Assistant.

Agent foydalanuvchi o'rniga Mentalaba platformasidagi barcha ma'lumotlarni topadi, tahlil qiladi va tabiiy tilda javob beradi.

---

# High Level Architecture

```

                User

↓

Frontend Chat

↓

Backend API

↓

Chat Controller

↓

Chat Service

↓

Intent Classifier

↓

Tool Router

↓

Mentalaba API

↓

Context Builder

↓

LLM

↓

Formatted Answer

↓

Frontend

```

---

# Main Components

## 1. Frontend

Vazifasi

- Chat UI
- Streaming Response
- Chat History
- Authentication
- File Upload (future)
- Voice (future)

Responsible only for UI.

No business logic.

---

## 2. Backend

Backend orchestrator hisoblanadi.

Hech qachon Frontend LLM bilan to'g'ridan-to'g'ri gaplashmaydi.

Har doim:

Frontend

↓

Backend

↓

LLM

↓

Backend

↓

Frontend

---

## 3. Chat Service

Bu AI ning yuragi.

Har bir message shu yerga keladi.

Misol

User:

"PDP kontrakti qancha?"

↓

ChatService

↓

Classifier

↓

University Tool

↓

Context

↓

LLM

↓

Response

---

# Request Lifecycle

## Step 1

User yozadi.

```
PDP universitetida grant bormi?
```

---

## Step 2

Intent aniqlanadi.

```
intent:

find_grant
```

---

## Step 3

Entity aniqlanadi.

```
University:

PDP
```

---

## Step 4

Tool tanlanadi.

```
Grant Tool
```

---

## Step 5

Tool API ga murojaat qiladi.

```
GET

/v1/university-grants
```

---

## Step 6

Context tayyorlanadi.

Misol

```
University:

PDP

Grant:

100%

Deadline:

August

IELTS:

6.5

SAT:

1300
```

---

## Step 7

LLM contextni o'qiydi.

Natural javob yozadi.

---

# Agent Layers

```
Presentation Layer

↓

Conversation Layer

↓

Reasoning Layer

↓

Tool Layer

↓

Mentalaba API

↓

Database
```

---

# Conversation Layer

Bu qatlam chat tarixini boshqaradi.

Saqlanadi:

User message

Assistant response

Timestamp

Conversation ID

Tool calls

Intent

Entity

---

# Reasoning Layer

Bu qatlam LLM.

Vazifasi

Savolni tushunish

Intent chiqarish

Tool tanlash

Natural javob yozish

Comparison qilish

Recommendation berish

Summary qilish

---

# Tool Layer

LLM API ni bilmaydi.

LLM faqat Tool nomini aytadi.

Misol

```
Need:

University Tool
```

Backend esa:

```
GET

/v1/universities/...
```

ni chaqiradi.

---

# Mentalaba APIs

Agent quyidagi API larni ishlatadi.

## Universities

```
GET /universities

GET /universities/one

GET /universities/filter

GET /universities/user-side

GET /universities/get-university-slug
```

---

## Directions

```
GET /directions

GET /directions/user-side

GET /directions/{slug}
```

---

## Grants

```
GET /university-grants/user-side
```

---

## News

```
GET /news
```

---

## Regions

```
GET /locations/regions
```

---

## Education Types

```
GET /education-types
```

---

## Languages

```
GET /education-languages
```

---

## Degrees

```
GET /degrees
```

---

# Context Builder

LLM hech qachon API javobini to'liq olmaydi.

Masalan API:

```
{
 name,
 slug,
 logo,
 address,
 grant,
 contract,
 gallery,
 ...
}
```

LLM ga esa faqat kerakli qismlar yuboriladi.

Misol

```
University

PDP

Grant

Available

IELTS

6.5

Contract

35 mln

Dormitory

Yes
```

Bu tokenni tejaydi.

---

# Prompt Builder

Prompt har safar qayta yig'iladi.

Prompt tarkibi

System Prompt

Conversation

Context

User Question

---

Misol

```
SYSTEM

You are Mentalaba AI Assistant.

Always answer using provided context.

Never hallucinate.

If information is unavailable say so.

--------------------

CONTEXT

PDP

Contract

35 mln

Grant

Available

--------------------

USER

Kontrakti qancha?
```

---

# Tool Selection

Classifier quyidagilardan birini tanlaydi.

```
University Tool

Direction Tool

Grant Tool

News Tool

Search Tool

Compare Tool

Calculator Tool

FAQ Tool
```

---

# Memory

Har conversation saqlanadi.

```
Conversation ID

Messages

Last University

Last Direction

Language

Timestamp
```

Misol

User:

```
PDP haqida ayt.
```

Keyin

```
Kontrakti qancha?
```

AI biladi:

```
Kontrakti qancha?

↓

PDP
```

---

# Session Context

Saqlanadi

```
Current University

Current Degree

Current Language

Current Region

Current Filters
```

---

# Streaming Response

LLM javobi streaming qilinadi.

```
User

↓

Backend

↓

LLM

↓

Token

↓

Token

↓

Token

↓

Frontend
```

ChatGPT kabi yozilib boradi.

---

# Error Handling

Agar API ishlamasa

```
Universitet ma'lumotini olishda xatolik yuz berdi.
```

Agar LLM ishlamasa

```
AI vaqtincha ishlamayapti.
```

Agar Tool topilmasa

```
Mos tool topilmadi.
```

---

# Security

LLM hech qachon:

Database

JWT

Password

Secret

API Key

larni ko'rmaydi.

Faqat Tool orqali ishlaydi.

---

# Logging

Har request log qilinadi.

```
Conversation ID

Intent

Entity

Selected Tool

Execution Time

API Calls

LLM Tokens

Response Time
```

---

# Scalability

Kelajakda qo'shiladi.

- Redis Cache
- Semantic Cache
- Vector Database
- RAG
- OCR
- Voice Assistant
- Image Understanding
- PDF Analysis
- Recommendation Engine

---

# Future Architecture

```
                User
                  │
                  ▼
          Frontend (Next.js)
                  │
                  ▼
          Chat Controller
                  │
                  ▼
            Chat Service
                  │
     ┌────────────┼────────────┐
     ▼            ▼            ▼
 Intent      Memory       Context
Classifier    Manager      Builder
     │            │            │
     └────────────┼────────────┘
                  ▼
            Tool Router
                  │
 ┌────────┬────────┬────────┬────────┐
 ▼        ▼        ▼        ▼
University Direction Grant News
 Tool      Tool      Tool   Tool
                  │
                  ▼
          Mentalaba APIs
                  │
                  ▼
           Context Builder
                  │
                  ▼
               LLM API
                  │
                  ▼
          Streaming Response
                  │
                  ▼
              Frontend UI
```

---

# Design Principles

- LLM never accesses database directly.
- Every external request goes through a Tool.
- API responses are normalized before reaching the LLM.
- Context must be minimal but sufficient.
- Conversation memory is session-based.
- Streaming is enabled by default.
- Every response must be traceable to its source.
- Architecture must support future RAG integration without breaking existing modules.