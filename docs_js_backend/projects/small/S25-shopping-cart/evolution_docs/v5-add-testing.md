# v5-add-testing

## Goal
Prove the cart logic works: add, merge, expiry, and ID unpredictability.

## Changes
1. Add `node:test` + `supertest` integration tests.
2. Unit-test `calculateTotal` and `mergeCartOnLogin`.
3. Add a **failing test** for predictable IDs to drive the fix in v6.

## Code

```ts
// tests/app.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/index.js';

describe('Cart', () => {
  it('creates a new cart when no cartId provided', async () => {
    const res = await request(app).post('/cart/add').send({ productId: 'p1', productName: 'Widget', quantity: 2, price: 10 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.items.length, 1);
  });

  it('merges guest and user carts by adding quantities', async () => {
    const guest = await request(app).post('/cart/add').send({ productId: 'p1', productName: 'Widget', quantity: 1, price: 10 });
    const user = await request(app).post('/cart/add').send({ productId: 'p1', productName: 'Widget', quantity: 2, price: 10 });
    const merged = await request(app).post('/cart/merge').send({ guestCartId: guest.body.id, userCartId: user.body.id });
    assert.strictEqual(merged.body.items[0].quantity, 3);
  });
});
```

## Decisions
- `node:test` (built-in) avoids Jest/Vitest dependency bloat for a small project.
- Keep tests idempotent by clearing the in-memory store in `beforeEach`.

## Risks
- Tests pass against in-memory Map. Need Redis-backed tests once persistence lands.
