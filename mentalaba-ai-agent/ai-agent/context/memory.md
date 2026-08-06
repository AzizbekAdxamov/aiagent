# Kontekst — Xotira

## Umumiy ma'lumot

Sessiyalar bo'ylab foydalanuvchi afzalliklari va muhim ma'lumotlarni saqlaydigan AI agent uchun xotira boshqaruvi.

## Qisqa muddatli xotira

Sessiyada saqlanadi: so'nggi suhbat konteksti (oxirgi N ta xabar).

```typescript
interface ShortTermMemory {
  messages: Message[];
  current_context: {
    intent: string;
    entities: Entity[];
    last_query: string;
  };
}
```

## Uzoq muddatli xotira

Sessiyalar bo'ylab saqlanadi (kelajak xususiyati):
- Foydalanuvchi afzalliklari (viloyat, til va boshqalar)
- Saqlangan/xatcho'p qilingan elementlar
- O'tgan qidiruvlar
- O'zaro aloqalar tarixi

## Xotira tuzilishi

```typescript
interface UserMemory {
  user_id?: string;
  preferences: {
    preferred_region?: number;
    preferred_language?: number;
    preferred_degree?: number;
    budget_max?: number;
  };
  recent_searches: string[];
  saved_items: string[];
  past_contexts: SessionContext[];
}
```

## Qidirish

Xotira har bir suhbat boshida olinadi va quyidagilar uchun ishlatiladi:
1. Javoblarni shaxsiylashtirish
2. Tavsiyalar berish
3. To'xtatilgan suhbatlarni davom ettirish
4. Takroriy savollardan qochish
