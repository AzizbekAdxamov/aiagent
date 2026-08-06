# Kontekst — Sessiya

## Umumiy ma'lumot

Faol foydalanuvchi suhbatlarini kuzatish uchun sessiya boshqaruvi.

## Sessiya ma'lumotlari

```typescript
interface Session {
  id: string;
  user_id?: string;
  created_at: Date;
  last_activity: Date;
  expires_at: Date;
  context: {
    current_intent: string | null;
    entities_in_scope: Entity[];
    conversation_history: Message[];
    pending_clarification: boolean;
  };
  metadata: {
    user_agent: string;
    ip: string;
    language: string;
  };
}
```

## Sessiya hayot aylanishi

1. **Yaratish** — Birinchi xabarda yangi sessiya
2. **Yangilash** — Har bir o'zaro aloqadan keyin kontekst yangilanadi
3. **Muddati tugash** — Sessiya harakatsizlikdan keyin tugaydi (standart 30 daqiqa)
4. **Qayta boshlash** — Sessiya kontekstni saqlagan holda qayta boshlanishi mumkin

## Saqlash

- Faol sessiyalar Redisda keshlangan
- Muddati tugagan sessiyalar tahlil uchun ma'lumotlar bazasiga saqlanadi
- Sessiya ID davomiylik uchun cookie/localStorage'da saqlanadi

## Kontekst doirasi

- Sessiya konteksti joriy suhbat bilan cheklangan
- Eslatilgan ob'ektlar kuzatuv savollari uchun "doira ichida" qoladi
- "bu", "shu", "ular" kontekstdagi ob'ektlarga ishora qiladi
