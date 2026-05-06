# v3: Add Validation — Feature Flag Service

## The Pain

You POST a new flag:

```json
{ "name": "dark-mode", "enabled": true, "rolloutPercentage": 150 }
```

The server accepts it. When a user checks this flag, `Math.random() * 100 <= 150` is always true. The flag is effectively 100% rollout, but the dashboard says 150%. Worse:

```json
{ "name": "new-checkout", "enabled": "yes", "rolloutPercentage": 10 }
```

`enabled: "yes"` is truthy in JavaScript. The flag is on. But when you serialize to JSON later, `"yes"` breaks a strict boolean consumer. A TypeScript frontend gets a type error.

## The Solution

Add runtime validation for every input.

## Before (No Validation)

```typescript
// src/index.ts
app.post('/flags/:flag', (req, res) => {
  const { flag } = req.params;
  const { enabled, rolloutPercentage, userIds } = req.body;
  service.setFlag({ name: flag, enabled, rolloutPercentage, userIds });
  res.json({ flag, enabled, rolloutPercentage });
});
```

## After (With Validation)

```typescript
// src/validation.ts
export function validateFlagConfig(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof body.enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }

  if (typeof body.rolloutPercentage !== 'number') {
    errors.push('rolloutPercentage must be a number');
  } else if (body.rolloutPercentage < 0 || body.rolloutPercentage > 100) {
    errors.push('rolloutPercentage must be between 0 and 100');
  }

  if (body.userIds !== undefined && !Array.isArray(body.userIds)) {
    errors.push('userIds must be an array');
  } else if (Array.isArray(body.userIds)) {
    for (const id of body.userIds) {
      if (typeof id !== 'string') {
        errors.push('userIds must contain only strings');
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
```

```typescript
// src/index.ts
import { validateFlagConfig } from './validation.js';

app.post('/flags/:flag', (req, res) => {
  const { flag } = req.params;
  const validation = validateFlagConfig(req.body);

  if (!validation.valid) {
    return res.status(400).json({ error: 'Invalid flag config', details: validation.errors });
  }

  const { enabled, rolloutPercentage, userIds } = req.body;
  service.setFlag({ name: flag, enabled, rolloutPercentage, userIds });
  res.json({ flag, enabled, rolloutPercentage });
});
```

## The Bug It Catches

- `rolloutPercentage: 150` → `400 Invalid flag config`
- `enabled: "yes"` → `400 Invalid flag config`
- `userIds: [123, 456]` → `400 userIds must contain only strings`
- `rolloutPercentage: "10"` → `400 rolloutPercentage must be a number`

## Why Validation Matters

- **Data integrity**: Garbage in → garbage out. Validation stops garbage at the door.
- **Security**: `userIds: { __proto__: { admin: true } }` is an object, not an array. Validation rejects it.
- **Contract stability**: Consumers can rely on `rolloutPercentage` always being `0-100`.
- **Debugging**: A 400 with "rolloutPercentage must be between 0 and 100" is infinitely better than silent data corruption.

Without validation, your API is a `any`-typed free-for-all. With validation, it is a contract.
