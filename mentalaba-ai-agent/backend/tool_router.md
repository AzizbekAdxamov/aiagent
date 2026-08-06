# Backend — Vosita Routeri

## Maqsad

AI agent vosita chaqiruvlarini tegishli backend xizmatlariga yo'naltiradi.

## Vosita ro'yxati

```typescript
const toolRegistry = {
  get_university: {
    handler: universityService.getById,
    params: ['id', 'slug'],
    returns: 'university'
  },
  search_university: {
    handler: universityService.search,
    params: ['search', 'region_id', 'category_id', 'type_id', ...],
    returns: 'university[]'
  },
  search_direction: {
    handler: directionService.search,
    params: ['search', 'category_id', 'degree_id', ...],
    returns: 'direction[]'
  },
  search_grants: {
    handler: grantService.search,
    params: ['search', 'type', 'university_id', ...],
    returns: 'grant[]'
  },
  search_news: {
    handler: newsService.search,
    params: ['search', 'tags', ...],
    returns: 'news[]'
  },
  compare_universities: {
    handler: universityService.compare,
    params: ['university_ids'],
    returns: 'comparison'
  },
  recommend: {
    handler: recommendationService.generate,
    params: ['preferences'],
    returns: 'recommendation'
  },
  navigation: {
    handler: navigationService.handle,
    params: ['action', 'target'],
    returns: 'navigation_result'
  }
};
```

## Bajarish jarayoni

1. LLM dan vosita chaqiruvini olish
2. Vosita nomi va parametrlarini tekshirish
3. Ro'yxatdan o'tgan handlerni chaqirish
4. Xatolarni chiroyli boshqarish
5. LLM ga strukturali natijani qaytarish
