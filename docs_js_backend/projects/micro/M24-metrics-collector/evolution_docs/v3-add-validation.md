# v3: Add Validation — Metrics Collector

## The Pain

You POST a metric:

```json
{ "name": "response_time", "value": "fast" }
```

The metrics collector stores `"fast"`. Later, `getMetrics()` calls `.sort()` on an array of strings:

```typescript
const values = records.map(r => r.value).sort((a, b) => a - b);
// "fast" - "fast" = NaN
```

All statistics become `NaN`. The dashboard shows blank graphs. The alerting system thinks everything is fine (`NaN < threshold` is `false`).

## The Solution

Validate metric inputs at ingestion time.

## Before (No Validation)

```typescript
// src/index.ts
app.post('/metrics', (req, res) => {
  const { name, value, tags } = req.body;
  collector.record(name, value, tags || {});
  res.status(201).json({ recorded: true });
});
```

## After (With Validation)

```typescript
// src/validation.ts
export function validateMetric(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!body.name || typeof body.name !== 'string') {
    errors.push('name is required and must be a string');
  }

  if (typeof body.value !== 'number' || isNaN(body.value)) {
    errors.push('value is required and must be a number');
  }

  if (body.tags !== undefined) {
    if (typeof body.tags !== 'object' || Array.isArray(body.tags)) {
      errors.push('tags must be an object');
    } else {
      for (const [k, v] of Object.entries(body.tags)) {
        if (typeof v !== 'string') {
          errors.push(`tag value for "${k}" must be a string`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
```

```typescript
// src/index.ts
import { validateMetric } from './validation.js';

app.post('/metrics', (req, res) => {
  const validation = validateMetric(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: 'Invalid metric', details: validation.errors });
  }

  const { name, value, tags } = req.body;
  collector.record(name, value, tags || {});
  res.status(201).json({ recorded: true });
});
```

## The Bug It Catches

- `value: "fast"` → `400 value is required and must be a number`
- `value: NaN` → `400 value is required and must be a number`
- `tags: { endpoint: 123 }` → `400 tag value for "endpoint" must be a string`
- `name: null` → `400 name is required and must be a string`

## Why Validation Matters

- **Data integrity**: Only clean data enters the aggregation pipeline
- **NaN prevention**: `isNaN(body.value)` catches the silent killer of math
- **Tag safety**: String-only tags prevent object injection in log consumers
- **Early failure**: 400 at ingestion is better than `NaN` in production dashboards

Without validation, your metrics pipeline ingests garbage and produces garbage. With validation, garbage is rejected at the door.
