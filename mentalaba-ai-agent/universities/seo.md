# Universitetlar — SEO

## SEO metama'lumotlari

Har bir universitet sahifasi quyidagilarni o'z ichiga olishi kerak:

```html
<meta name="description" content="Addis Ababa University (አዲስ አበባ ዩኒቨርሲቲ) haqida ma'lumot oling. 
Dasturlar, qabul talablari, to'lovlar va mavjud grantlarni toping." />
<meta property="og:title" content="Addis Ababa University | Mentalaba" />
<meta property="og:description" content="..." />
<meta property="og:image" content="https://.../university_cover.jpg" />
<meta property="og:type" content="article" />
<meta name="twitter:card" content="summary_large_image" />
```

## Strukturali ma'lumotlar (JSON-LD)

```json
{
  "@context": "https://schema.org",
  "@type": "CollegeOrUniversity",
  "name": "Addis Ababa University",
  "alternateName": "አዲስ አበባ ዩኒቨርሲቲ",
  "url": "https://mentalaba.com/universities/addis-ababa-university",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Addis Ababa",
    "addressCountry": "ET"
  }
}
```

## SEO eng yaxshi amaliyotlari

- Barcha sahifalar uchun kanonik URL'lardan foydalanish
- Amhar/Ingliz versiyalari uchun hreflang teglarini qo'shish
- Barcha universitet sahifalari uchun sayt xaritalarini yaratish
- Rasmlar uchun tavsiflovchi alt matnidan foydalanish
- CDN bilan sahifa yuklash tezligini optimallashtirish
