# Backend — Loglash

## Maqsad

Monitoring, disk raskadrovka va tahlil uchun keng qamrovli loglash.

## Log darajalari

| Daraja | Foydalanish |
|-------|-------|
| ERROR | Tizim nosozliklari, ishlov berilmagan istisnolar |
| WARN | Samaradorlik pasayishi, tezlik cheklash |
| INFO | Asosiy operatsiyalar (foydalanuvchi so'rovlari, vosita chaqiruvlari) |
| DEBUG | Batafsil operatsiya izlari (rivojlanish) |

## Log kategoriyalari

### So'rov loglari
- Method, yo'l, holat, davomiylik
- Foydalanuvchi agenti, IP
- Sessiya ID

### Vosita chaqiruvi loglari
- Vosita nomi, parametrlari, natija hajmi
- Davomiylik, muvaffaqiyat/muvaffaqiyatsizlik
- LLM tokenlari ishlatilgan

### LLM loglari
- Model, tokenlar kirish/chiqish
- Xarajat bahosi
- Kechikish
- Xato darajalari

### Xato loglari
- Stack izlari
- So'rov konteksti
- Xato turi va xabari
- Ta'sir bahosi

## Log saqlash

- Rivojlanish: Konsol + fayl aylanishi
- Ishlab chiqarish: Logging xizmatiga strukturali JSON (masalan, Logstash, CloudWatch)
- Saqlash: 30 kun (ishlab chiqarish), 7 kun (rivojlanish)

## Tahlil

- Kundalik faol foydalanuvchilar
- Eng ko'p qidirilgan universitetlar
- Keng tarqalgan intentsiyalar
- O'rtacha sessiya davomiyligi
- Sessiya uchun LLM xarajati
- Xato darajasi tendentsiyalari
