# Backend — LLM Xizmati

## Maqsad

LLM provayderi (OpenAI, Claude yoki shunga o'xshash) bilan integratsiyani boshqaradi.

## Konfiguratsiya

```typescript
interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'custom';
  model: string;              // masalan, 'gpt-4o', 'claude-3.5-sonnet'
  temperature: number;        // 0.1 faktli, 0.7 ijodiy uchun
  maxTokens: number;          // 4096 standart
  apiKey: string;             // Muhitdan
  baseUrl?: string;           // Maxsus API endpoint
}
```

## Xizmat metodlari

```typescript
interface LLMService {
  // Vosita ta'riflari bilan xabarlarni yuborish
  chat(messages: Message[], tools: Tool[]): Promise<ChatResponse>;
  
  // Real-time UI uchun oqimli javob
  chatStream(messages: Message[], tools: Tool[]): AsyncIterable<Chunk>;
  
  // Oddiy to'ldirish (vosita qo'llab-quvvatlamaydi)
  complete(prompt: string): Promise<string>;
  
  // Intentsiyani tasniflash
  classifyIntent(message: string): Promise<IntentClassification>;
}
```

## Tizim promptini yig'ish

```
Tizim Prompti = 
  Asosiy Tizim Prompti +
  Ishlab Chiqaruvchi Prompti +
  Faol Vosita Ta'riflari +
  Kontekst (sessiya, xotira, tarix)
```

## Xarajat boshqaruvi

- Sessiya bo'yicha token foydalanishni kuzatish
- LLM chaqiruvidan oldin xarajatni baholash
- Murakkablikka qarab model tanlash
- Tez-tez so'raladigan so'rovlarni keshlash
- Iloji bo'lganda ommaviy ishlov berish
