# v3-add-validation.md — UUID Generator

## The Pain

TypeScript (v2) gave us a `UUID` branded type, but runtime validation was weak:

```typescript
export function isValidUUID(uuid: string): uuid is UUID {
  return /^[0-9a-f-]{36}$/i.test(uuid);
}
```

1. `isValidUUID('gggggggg-gggg-gggg-gggg-gggggggggggg')` returns `true` — the regex is too permissive.
2. `isValidUUID('550e8400-e29b-11d4-a716-446655440000')` returns `true` — but this is UUID v1, not v4.
3. A client sending an invalid UUID to `/validate/:uuid` gets a `200 OK` with `valid: false` — which is correct behavior, but the validation itself is lying about what "valid" means.

## The Fix: Add Strict Runtime Validation

```typescript
// uuid.ts
import { randomUUID } from 'node:crypto';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function generateUUID(): UUID {
  return randomUUID() as UUID;
}

export function isValidUUID(uuid: string): uuid is UUID {
  return UUID_V4_REGEX.test(uuid);
}
```

Now:
- `'gggggggg-gggg-gggg-gggg-gggggggggggg'` → `false` (invalid hex)
- `'550e8400-e29b-11d4-a716-446655440000'` → `false` (version 1, not 4)
- `'550e8400-e29b-41d4-a716-446655440000'` → `true` (version 4, valid variant)

We also add a route-level validation schema:

```typescript
// validation.ts
import { z } from 'zod';

export const uuidParamSchema = z.object({
  uuid: z.string().uuid(),
});
```

## But Validation Doesn't Fix Predictability

`generateUUID()` still uses `Math.random()` in some versions. Strict validation only catches bad input — it doesn't make generation cryptographically secure.

> **Lesson:** Strict validation enforces format correctness. But generation security depends on using a CSPRNG (see v7).
