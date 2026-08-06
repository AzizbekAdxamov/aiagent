# Qidiruv prompti

## Maqsad

AI agent qanday qidiruvlarni amalga oshirishi va natijalarni foydalanuvchilarga taqdim etishi bo'yicha ko'rsatma.

## Qidiruv strategiyasi

1. **So'rovni tahlil qilish** — Kalit so'zlar, filtrlar va intentsiyani ajratib olish
2. **Parametrlarni yaratish** — Foydalanuvchi so'rovini API parametrlariga moslashtirish
3. **Qidiruvni bajarish** — Tegishli qidiruv vositasini chaqirish
4. **Natijalarni tartiblash** — Aloqadorlik bo'yicha tartiblash
5. **Natijalarni taqdim etish** — Kartalar va tabiiy til bilan formatlash

## So'rov namunalari

| Foydalanuvchi aytadi | Intentsiya | Parametrlar |
|---------------------|------------|-------------|
| "Addis Ababadagi universitetlarni toping" | university_search | region_id=1 |
| "Kompyuter fanlari dasturlari" | direction_search | search=computer science |
| "Muhandislik stipendiyalari" | grant_search | search=engineering |
| "AAU haqida yangiliklar" | news_search | university_id=uni_123 |

## Noaniq moslik

Quyidagi holatlar uchun noaniq moslikdan foydalaning:
- Qisman nom mosliklari (masalan, "AAU" → "Addis Ababa University")
- Kichik imlo xatolari
- O'zbekcha transliteratsiyalar
- Qisqartmalar

## Bo'sh natijalar

Natija topilmaganda:
- Kengroq qidiruvni taklif qiling
- Alternativ imlolarni tekshiring
- Foydalanuvchi boshqa kategoriyani qidirmoqchi bo'lishi mumkinligini so'rang
