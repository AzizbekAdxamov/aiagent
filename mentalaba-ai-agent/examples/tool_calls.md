# Misollar — Vosita chaqiruvlari

## LLM vosita chaqiruvi misollari

### search_university

LLM universitetlarni qidirishga qaror qiladi:

```json
{
  "role": "assistant",
  "content": null,
  "tool_calls": [{
    "id": "call_001",
    "type": "function",
    "function": {
      "name": "search_university",
      "arguments": "{\"search\": \"addis ababa\", \"limit\": 5}"
    }
  }]
}
```

### get_university

LLM ma'lum bir universitetni oladi:

```json
{
  "name": "get_university",
  "parameters": {
    "slug": "addis-ababa-university"
  }
}
```

### search_direction filtrlar bilan

```json
{
  "name": "search_direction",
  "parameters": {
    "search": "computer science",
    "degree_id": 4,
    "language_id": 1,
    "limit": 10
  }
}
```

### compare_universities

```json
{
  "name": "compare_universities",
  "parameters": {
    "university_ids": ["uni_001", "uni_005", "uni_010"]
  }
}
```

### recommend

```json
{
  "name": "recommend",
  "parameters": {
    "preferences": {
      "region_id": 1,
      "degree_id": 4,
      "budget_max": 50000,
      "language_id": 1,
      "education_type_id": 1
    }
  }
}
```
