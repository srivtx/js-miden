# M02 JSON Validator

## PHASE 1 - Problem

Build an API endpoint that accepts JSON, validates it against a schema, and returns **400** with structured error details if invalid.

**Schema Requirements:**
- `name`: string, 2-50 characters
- `email`: valid email format
- `age`: number, 18-120

## PHASE 2 - Thinking

- Manual validation with `if/else` is error-prone and verbose
- JSON Schema is standard but verbose and requires extra tooling
- Zod is TypeScript-native, gives us **types AND runtime validation** from a single source
- What about extra fields? Should we strip them or reject? Accepting them could leak unexpected data downstream
- What about type coercion? `"25"` string → `25` number? Strict APIs should not silently coerce

## PHASE 3 - Decisions

- **Use Zod** (not Joi, not Yup) — best TypeScript integration, infer types automatically
- **Strip unknown fields** — security: don't accept unexpected data that could be passed downstream
- **No type coercion** — strict validation: `"25"` as a string should fail for a number field
- **Return structured error messages** — array of `{ field, message }` objects for easy client-side handling

## PHASE 4 - Code

Stack: **Express 5, TypeScript, ESM, Zod**

### Files
- `src/validation.ts` — Zod schema definition
- `src/app.ts` — Express app with `/validate` endpoint
- `src/index.ts` — Server bootstrap
- `tests/validation.test.ts` — Vitest + Supertest suite

## PHASE 5 - The Bug

**Intentional subtle bug:** The Zod schema uses `.passthrough()` which allows extra fields to pass through validation instead of being stripped. This violates the security decision in Phase 3.

**Test that catches it:** `strips unknown fields (security)` sends `role: "admin"` and asserts it is **not** present in the response data. With `.passthrough()`, the extra field is included in the parsed output and the test fails.

**Fix:** Remove `.passthrough()`. Zod's default behavior for `z.object().parse()` is to strip unknown keys, which matches our Phase 3 decision.

---

## Running

```bash
npm install
npm run dev     # Start server with tsx
npm test        # Run vitest suite
```

## API

### POST /validate

**Request Body:**
```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "age": 25
}
```

**Success 200:**
```json
{
  "valid": true,
  "data": {
    "name": "Alice",
    "email": "alice@example.com",
    "age": 25
  }
}
```

**Error 400:**
```json
{
  "valid": false,
  "errors": [
    { "field": "age", "message": "Number must be greater than or equal to 18" }
  ]
}
```
