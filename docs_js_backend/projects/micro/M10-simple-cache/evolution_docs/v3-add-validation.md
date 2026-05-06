# v3-add-validation.md — Simple Cache

## The Pain

TypeScript (v2) gave us typed keys and values, but it didn't prevent bad runtime input:

```typescript
router.post('/', (req, res) => {
  const { key, value } = req.body as { key?: string; value?: unknown };
  cache.set(key, value);
  // What if key is an empty string?
  // What if value is undefined?
  // What if key is 10MB long?
});
```

1. Empty string key: `cache.set('', value)` — valid but useless.
2. `undefined` value: indistinguishable from a missing key when retrieved.
3. Huge key: wastes memory, potential DoS.

## The Fix: Add Runtime Validation

```typescript
// validation.ts
import { z } from 'zod';

export const cacheSetSchema = z.object({
  key: z.string().min(1).max(256),
  value: z.unknown(),
});
```

```typescript
// routes.ts
import { cacheSetSchema } from './validation.js';

router.post('/', (req, res) => {
  const parse = cacheSetSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }

  const { key, value } = parse.data;
  cache.set(key, value);
  res.status(201).json({ key, value, ttl: 60 });
});
```

Now the API rejects:
```bash
curl -X POST http://localhost:3000/cache -d '{"key":"","value":"x"}'
# 400 — key cannot be empty

curl -X POST http://localhost:3000/cache -d '{"value":"x"}'
# 400 — key is required
```

## But Validation Doesn't Fix Memory Leaks

The cache still has no size limit. An attacker can script 1 million valid requests with 1-character keys and fill memory. And `setTimeout` per key still leaks when keys are overwritten.

> **Lesson:** Validation prevents bad individual requests. But resource exhaustion requires rate limiting and bounded data structures.
