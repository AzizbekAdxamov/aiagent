# Yo'nalishlar — Sxema yaratish

## Ma'lumotlar bazasi sxemasi

```sql
CREATE TABLE directions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    name_am VARCHAR(255),
    category_id INTEGER REFERENCES direction_categories(id),
    description TEXT,
    description_am TEXT,
    duration_years DECIMAL(3,1),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE direction_education_types (
    direction_id UUID REFERENCES directions(id),
    education_type_id INTEGER REFERENCES education_types(id),
    language_id INTEGER REFERENCES education_languages(id),
    PRIMARY KEY (direction_id, education_type_id, language_id)
);

CREATE TABLE direction_tuition (
    direction_id UUID REFERENCES directions(id),
    contract_type_id INTEGER REFERENCES contract_types(id),
    amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'ETB',
    per_year BOOLEAN DEFAULT true
);

CREATE TABLE direction_degree (
    direction_id UUID REFERENCES directions(id),
    degree_id INTEGER REFERENCES degrees(id),
    is_available BOOLEAN DEFAULT true
);
```

## API sxemasi (Yaratish so'rovi)

```json
{
  "name": "Computer Science",
  "name_am": "ኮምፒውተር ሳይንስ",
  "category_id": 10,
  "description": "...",
  "description_am": "...",
  "duration_years": 4,
  "education_types": [
    { "type_id": 1, "language_id": 1 }
  ],
  "tuition": [
    { "contract_type_id": 1, "amount": 0 },
    { "contract_type_id": 3, "amount": 25000 }
  ],
  "degrees": [1, 4],
  "subjects": [1, 2, 3]
}
```
