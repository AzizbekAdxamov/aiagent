# Navigatsiya — Harakatlar

## Maqsad

AI agent bajarishi mumkin bo'lgan barcha navigatsiya harakatlarini aniqlash.

## Harakat turlari

| Harakat | Tavsif | Maqsad |
|---------|--------|--------|
| `navigate` | Sahifa/ob'ektga o'tish | URL yoki ob'ekt yo'li |
| `open_chat` | Chat interfeysini ochish | — |
| `close_chat` | Chat interfeysini yopish | — |
| `view_details` | Ob'ekt tafsilotlarini ko'rsatish | Ob'ekt ID |
| `compare` | Taqqoslashni boshlash | Ob'ekt ID'lari |
| `share` | Joriy ko'rinishni ulashish | — |
| `save` | Ob'ektni saqlash/xatcho'p | Ob'ekt ID |
| `remove_saved` | Saqlanganlardan olib tashlash | Saqlangan element ID |
| `scroll_to` | Xabar/kartaga o'tish | Maqsadli element |
| `expand_card` | Kartani kengaytirish/yig'ish | Karta ID |

## Harakat parametrlari

```typescript
interface NavigationAction {
  action: string;
  target?: string;
  params?: Record<string, any>;
}
```

## Harakat misollari

```json
[
  { "action": "navigate", "target": "/universities/addis-ababa-university" },
  { "action": "open_chat" },
  { "action": "view_details", "target": "uni_123" },
  { "action": "save", "target": "uni_123", "params": { "type": "university" } }
]
```
