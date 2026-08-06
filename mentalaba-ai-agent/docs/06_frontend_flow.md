# Frontend jarayoni

## Foydalanuvchi sayohati

```
Kirish sahifasi
    │
    ▼
┌──────────────────────┐
│  Suzuvchi tugma (FAB)│────▶ Chat interfeysi ochiladi
└──────────────────────┘
    │                           │
    ▼                           ▼
┌──────────────────────┐  ┌──────────────────────┐
│   Yanpanel (ixtiyoriy│  │   Chat oynasi        │
│  - Tarix             │  │  - Xabarlar           │
│  - Saqlanganlar      │  │  - Taklif kartalari  │
│  - Sozlamalar        │  │  - Kartalar (Uni/Dir/│
│                      │  │    Grant/Yangilik)    │
└──────────────────────┘  └──────────────────────┘
                                   │
                                   ▼
                            ┌──────────────────┐
                            │   Chat kiritish  │
                            │  - Matn kiritish │
                            │  - Tezkor amallar│
                            │  - Yuborish tugm.│
                            └──────────────────┘
```

## Komponent daraxti (React)

```
<App>
  <Sidebar>
    <HistoryList />
    <SavedItems />
  </Sidebar>
  <MainContent>
    <ChatHeader />
    <ChatMessages>
      <UserMessage />
      <AgentMessage>
        <UniversityCard />
        <DirectionCard />
        <GrantCard />
        <SuggestionCards />
        <LoadingState />
        <ErrorState />
      </AgentMessage>
    </ChatMessages>
    <ChatInput />
  </MainContent>
  <FloatingButton />
</App>
```

## Holat boshqaruvi

- **Chat holati:** Xabarlar, yuklash, xatolar, joriy kontekst
- **UI holati:** Yanpanel ochiq/yopiq, faol ko'rinish
- **Sessiya holati:** Foydalanuvchi afzalliklari, tarixi
- **Komponent holati:** Karta kengaytmalari, tanlovlar

## Responsiv dizayn

- Ish stoli: Yanpanel bilan to'liq tartib
- Planshet: Yig'iladigan yanpanel, ustunli kartalar
- Mobil: To'liq ekranli chat, pastki varaq kartalari
