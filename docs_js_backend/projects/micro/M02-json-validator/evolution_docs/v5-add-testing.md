# v5-add-testing.md — "I broke the health endpoint adding auth"

## The Bug

You add a new validation rule: age must be divisible by 1 (effectively an integer, but you add it as a custom refinement):

```ts
export const userSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().int().min(18).max(120),
}).refine((data) => data.age % 1 === 0, {
  message: 'Age must be a whole number',
});
```

The refine is redundant (`.int()` already ensures this) but harmless, right? You deploy. Users with `age: 18.5` start getting a confusing error: "Age must be a whole number" instead of the cleaner "Expected integer, received float" from `.int()`.

Worse, someone later changes `.int()` to `.positive()` (thinking "age just needs to be positive") and forgets about the refine. Now `age: 18.5` passes `.positive()` but fails the refine. The behavior is inconsistent and surprising.

You didn't test the error messages. You tested that valid input passes and invalid input fails. You didn't test *what* the error says.

## The 3am Page, Redux

You add a `.transform` to normalize email addresses:

```ts
email: z.string().email().transform((e) => e.toLowerCase().trim()),
```

This breaks the response format. A client sends `{ email: "Alice@Example.COM" }` and expects to get back exactly what they sent. Your API returns `{ email: "alice@example.com" }`. Their database does a case-sensitive lookup and can't find the user.

You didn't test the response shape. You tested that validation passes. You didn't test that the *output* matches expectations.

## Adding Vitest + Supertest

```bash
npm install -D vitest supertest @types/supertest
```

```ts
// tests/app.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('JSON Validator', () => {
  it('returns 200 for valid input', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ name: 'Alice', email: 'alice@example.com', age: 25 });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.data).toEqual({
      name: 'Alice',
      email: 'alice@example.com',
      age: 25,
    });
  });

  it('returns 400 for missing fields', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ name: 'Alice' });

    expect(res.status).toBe(400);
    expect(res.body.valid).toBe(false);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email' }),
        expect.objectContaining({ field: 'age' }),
      ])
    );
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ name: 'Alice', email: 'not-an-email', age: 25 });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContainEqual(
      expect.objectContaining({ field: 'email', message: expect.stringContaining('Invalid') })
    );
  });

  it('returns 400 for extra fields', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ name: 'Alice', email: 'a@b.com', age: 25, isAdmin: true });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('Unrecognized key') })
    );
  });

  it('returns 400 for wrong type', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ name: 'Alice', email: 'a@b.com', age: 'twenty-five' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContainEqual(
      expect.objectContaining({ field: 'age', message: expect.stringContaining('Expected number') })
    );
  });
});
```

Run the tests:

```bash
npm test
```

Every test passes. Now when you add the `.transform`, the first test fails:

```
Expected: { email: "Alice@Example.COM" }
Received: { email: "alice@example.com" }
```

The test caught the breaking change before deploy.

## Why Tests?

- **They are executable documentation.** The tests say exactly what valid and invalid look like.
- **They prevent regressions.** Change the schema → run tests → see what broke.
- **They test the contract.** Not just "does it return 200" but "does it return the exact shape the client expects."
- **They run in CI.** Every PR is verified before merge.

## What Changed

- Added Vitest and Supertest as dev dependencies
- Tests cover valid input, missing fields, wrong types, extra fields, invalid email
- Tests verify exact response shapes
- Tests run in CI with `npm test`

## What We Still Need

Tests verify behavior. But our module system is CommonJS (`require`/`module.exports`). Node.js 20+ prefers ESM. We need to modernize our imports.

For that, we need to switch to ESM.
