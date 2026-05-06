# v5-add-testing.md — UUID Generator

## The Pain

We added validation (v3) and logging (v4), but a "performance optimization" broke security:

```typescript
// "Optimization": use Math.random() for 10x faster UUID generation
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
```

Tests passed because:
1. The output looked like a UUID.
2. The regex validation passed.
3. No test checked for **cryptographic randomness**.

A security researcher observed 100 UUIDs, predicted the next 10, and accessed unauthorized resources. We had no tests for predictability.

## The Fix: Add Tests

```typescript
// tests/app.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('M14 UUID Generator', () => {
  it('POST /generate returns a valid UUID v4', async () => {
    const res = await request(app).post('/generate').expect(200);
    expect(res.body.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('GET /validate/:uuid returns true for valid UUID', async () => {
    const res = await request(app)
      .get('/validate/550e8400-e29b-41d4-a716-446655440000')
      .expect(200);
    expect(res.body.valid).toBe(true);
  });

  it('GET /validate/:uuid returns false for invalid UUID', async () => {
    const res = await request(app).get('/validate/not-a-uuid').expect(200);
    expect(res.body.valid).toBe(false);
  });

  it('GET /validate/:uuid returns false for wrong version', async () => {
    // UUID v1, not v4
    const res = await request(app)
      .get('/validate/550e8400-e29b-11d4-a716-446655440000')
      .expect(200);
    expect(res.body.valid).toBe(false);
  });

  it('generates unique UUIDs', async () => {
    const uuids = new Set();
    for (let i = 0; i < 100; i++) {
      const res = await request(app).post('/generate');
      uuids.add(res.body.uuid);
    }
    expect(uuids.size).toBe(100);
  });
});
```

## What Tests Caught

1. **Format validation:** UUID must match v4 regex (version 4, variant bits).
2. **Version enforcement:** UUID v1 is correctly rejected.
3. **Uniqueness:** 100 generated UUIDs must all be distinct (catches bad RNG seeding).

## But Tests Don't Fix Predictability

Tests verify format and uniqueness, but they can't statistically prove cryptographic security. `Math.random()` might pass 100 uniqueness checks by chance. We need algorithmic guarantees (see v7).

> **Lesson:** UUID tests verify format correctness. But cryptographic security is a property of the algorithm, not the test output.
