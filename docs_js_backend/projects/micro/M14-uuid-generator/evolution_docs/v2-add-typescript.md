# v2-add-typescript.md — UUID Generator

## The Pain

In v1 (pure JS), our UUID generator and validator were loosely typed:

```javascript
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(...);
}

function isValidUUID(uuid) {
  return /^[0-9a-f-]{36}$/i.test(uuid);
}
```

1. `isValidUUID(123)` silently coerces the number to string and returns `false` — but the intent was unclear.
2. `generateUUID()` was used as if it returned a validated UUID, but there was no type distinction.
3. A typo in the regex pattern went unnoticed:
   ```javascript
   /^[0-9a-f-]{36}$/i  // accepts 'gggggggg-gggg-gggg-gggg-gggggggggggg'
   ```

## The Fix: Add TypeScript

```typescript
// uuid.ts
export type UUID = string & { __brand: 'UUID' };

export function generateUUID(): UUID {
  return crypto.randomUUID() as UUID;
}

export function isValidUUID(uuid: string): uuid is UUID {
  return UUID_V4_REGEX.test(uuid);
}
```

Now TypeScript distinguishes a `UUID` from any `string`:
```typescript
const id: UUID = generateUUID();
const fake = 'not-a-uuid';

function lookup(id: UUID) { /* ... */ }
lookup(fake);  // error TS2345: Argument of type 'string' is not assignable to parameter of type 'UUID'
```

TypeScript also catches typos in regex and function names at compile time.

## But TypeScript Doesn't Catch Everything

TypeScript can't verify that `crypto.randomUUID()` is actually cryptographically secure — it only knows it returns a `string`. And it can't enforce that the regex checks version/variant bits at the type level.

> **Lesson:** TypeScript adds compile-time safety to UUID handling. But cryptographic correctness and regex strictness are still verified by tests and security review, not the type checker.
