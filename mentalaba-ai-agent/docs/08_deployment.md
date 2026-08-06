# Joylashtirish

## Muhit konfiguratsiyasi

| Muhit | Domen | Maqsad |
|-------|-------|--------|
| Rivojlanish | localhost:3000 | Mahalliy rivojlanish |
| Sinov | staging.mentalaba.com | Ishlab chiqarishdan oldingi testlash |
| Ishlab chiqarish | mentalaba.com | Jonli ilova |

## Infratuzilma talablari

- **Veb-server:** Nginx yoki Caddy reverse proxy uchun
- **Ilova serveri:** Node.js (yoki Python) vaqtinchalik muhiti
- **Ma'lumotlar bazasi:** Ulanish hovuzi bilan PostgreSQL
- **Kesh:** Sessiya va ma'lumotlarni keshlash uchun Redis
- **LLM API:** OpenAI API kaliti (yoki muqobil provayder)
- **Fayl saqlash:** Universitet galereyasi rasmlari uchun

## Joylashtirish bosqichlari

1. PostgreSQL ma'lumotlar bazasini sozlash va migratsiyalarni ishga tushirish
2. Muhit o'zgaruvchilarini sozlash
3. Frontend aktivlarini yaratish
4. Backend xizmatlarini ishga tushirish
5. Reverse proxy sozlash
6. SSL sertifikatlarini sozlash
7. Monitoring va loglashni sozlash

## CI/CD Tizimi

- **Manba nazorati:** GitHub/GitLab
- **CI:** GitHub Actions yoki GitLab CI
- **Testlash:** PR bo'yicha avtomatlashtirilgan test to'plami
- **Joylashtirish:** Asosiy tarmoqqa qo'shilganda avtomatik joylashtirish

## Monitoring

- Ilova samaradorligini monitoring qilish (APM)
- Xatolarni kuzatish va ogohlantirish
- LLM API foydalanish va xarajatlarni kuzatish
- Foydalanuvchi tahlillari
- Server resurslarini monitoring qilish
