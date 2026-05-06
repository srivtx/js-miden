# 00 — PROBLEM: JSON Validator

## What We're Building

A single HTTP API endpoint—`POST /validate`—that accepts a JSON payload, validates it against a strict schema, and returns one of two responses:

- **200 OK** if the payload is valid, with the validated (and stripped) data.
- **400 Bad Request** if the payload is invalid, with a structured array of error messages.

## Why It Exists

Every API that accepts user input is an attack surface. Without validation:

1. **Type confusion:** A string `"25"` where a number `25` is expected can crash database queries or cause calculation errors.
2. **Injection attacks:** Unexpected fields can be passed downstream to systems that trust the input.
3. **Data corruption:** A name with 10,000 characters can fill a database column and break indexes.
4. **Poor UX:** Generic "bad request" messages force frontend developers to guess what went wrong.

Validation is not a "nice to have." It is a **security and correctness requirement**.

## The Schema

| Field | Type | Constraints |
|-------|------|-------------|
| `name` | `string` | Min 2 chars, max 50 chars |
| `email` | `string` | Must be valid email format |
| `age` | `number` | Integer, min 18, max 120 |

**Additional rule:** Unknown fields must be **stripped**, not accepted. If the client sends `role: "admin"`, it must be removed from the output.

## Constraints

| Constraint | Rationale |
|------------|-----------|
| TypeScript + ESM | Modern Node.js; type safety; tree-shaking |
| Express 5 | Standard HTTP framework |
| Zod for validation | Single source of truth for types AND runtime validation |
| Vitest for testing | Native ESM, fast, Jest-compatible |
| No database | Scope boundary |
| No auth | Scope boundary |
| No coercion | `"25"` as string must fail for a number field |

## Scope Boundaries

```
IN SCOPE:
  ✓ JSON body parsing
  ✓ Runtime schema validation
  ✓ Structured error responses
  ✓ Type inference from schema
  ✓ Stripping unknown fields
  ✓ Unit tests for all validation rules

OUT OF SCOPE:
  ✗ Authentication / authorization
  ✗ Database persistence
  ✗ Partial updates (PATCH semantics)
  ✗ Nested object validation
  ✗ Custom error messages per locale
  ✗ OpenAPI / Swagger generation
```

## The Real-World Context

This pattern appears in every API you've ever used:

- **User registration:** Validate email, password strength, date of birth.
- **Checkout forms:** Validate credit card format, expiration date, CVV.
- **Configuration APIs:** Validate that a timeout is a positive integer, not a string.

The difference between amateur and professional backend code is often just this: **does it validate inputs rigorously, or does it hope the client sent the right shape?**
