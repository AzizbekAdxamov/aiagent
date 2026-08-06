# Backend — Sessiya

## Maqsad

Foydalanuvchi sessiyalari, kontekst va suhbat davomiyligini boshqaradi.

## Sessiya ma'lumot modeli

```typescript
interface Session {
  id: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  
  context: {
    intent: string | null;
    entities: {
      type: 'university' | 'direction' | 'grant' | 'news';
      id: string;
      name: string;
    }[];
    history: {
      role: 'user' | 'assistant';
      content: string;
      timestamp: Date;
    }[];
    preferences: UserPreferences;
    pendingAction: string | null;
  };
}
```

## Sessiya hayot aylanishi

1. **Yaratish**: Birinchi foydalanuvchi xabarida (sessiya ID yo'q)
2. **Davom ettirish**: Keyingi xabarlarda (sessiya ID bilan)
3. **Yangilash**: Har bir xabar almashinuvidan keyin
4. **Muddati tugash**: 30 daqiqa harakatsizlikdan keyin
5. **Tozalash**: Eski sessiyalar arxivlanadi

## Sessiya API'lari

```
POST /api/v1/sessions — Yangi sessiya yaratish
GET /api/v1/sessions/:id — Sessiya holatini olish
POST /api/v1/sessions/:id/context — Kontekstni yangilash
DELETE /api/v1/sessions/:id — Sessiyani tozalash
```

## Kontekstni aniqlash

"bu", "shu", "ular" kabi havolalarni aniqlash uchun:
1. Doiradagi ob'ektlarni tekshirish (oxirgi eslatilgan ob'ektlar)
2. Oxirgi intentsiyani tekshirish
3. Suhbat tarixini tekshirish
4. Eng yaxshi moslikni qaytarish yoki aniqlashtirishni so'rash
