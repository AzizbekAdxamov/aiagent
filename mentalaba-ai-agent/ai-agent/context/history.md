# Kontekst — Tarix

## Umumiy ma'lumot

Izchil ko'p bosqichli suhbatlarni saqlash uchun suhbat tarixi boshqaruvi.

## Tarix tuzilishi

```typescript
interface ConversationHistory {
  session_id: string;
  messages: Message[];
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata: {
    intent?: string;
    tool_calls?: ToolCall[];
    entities?: Entity[];
  };
}
```

## Tarix oynasi

- Oxirgi 20 ta xabar faol kontekstda saqlanadi
- Token samaradorligi uchun qisqartirilgan eski tarix
- Oyna hajmi sozlanishi mumkin

## Kontekstni saqlash

Kuzatuv savollari uchun agent quyidagilarni saqlaydi:
1. Oxirgi qidirilgan ob'ektlar
2. Joriy displey konteksti (foydalanuvchi nimani ko'rmoqda)
3. Hozirgacha aytilgan foydalanuvchi afzalliklari
4. Kutilayotgan harakatlar (arizalar, saqlashlar va boshqalar)

## Misol

```
Foydalanuvchi: "Menga Addis Ababadagi universitetlarni ko'rsat"
Agent: [universitetlar ro'yxati]
Foydalanuvchi: "Birinchi haqida batafsil aytib ber"
Agent: ["birinchi" = oldingi javobdagi birinchi universitet ekanligini biladi]
```
