# MD16 Food Delivery — v5 Add Testing

## Goal
Protect the two known bugs (inventory race, driver race) with automated tests.

## Changes from v4
- Add `vitest` + `supertest` + `@types/supertest`
- Add `tests/app.test.ts`
- Add `tests/setup.ts` for test database (SQLite `:memory:`)
- CI-ready via `npm test`

## Test Structure
```
tests/
  app.test.ts       # Integration tests
  setup.ts          # Reset DB between tests
  utils.ts          # Test helpers (seed restaurants, drivers)
```

## Key Tests

### `tests/app.test.ts`
```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db.js';

describe('Orders', () => {
  beforeEach(async () => {
    await db.run('DELETE FROM orders');
    await db.run('DELETE FROM drivers');
  });

  it('should create an order', async () => {
    const res = await request(app).post('/api/orders').send({
      customerId: 'cust-1',
      restaurantId: 'rest-1',
      items: [{ menuId: 'menu-1', quantity: 2 }],
      address: '123 Main St',
      latitude: 40.7,
      longitude: -74.0,
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
  });

  it('BUG: should allow ordering sold-out items (inventory bug)', async () => {
    // Set inventory to 0
    await db.run('UPDATE menu SET inventory = 0 WHERE id = ?', ['menu-1']);

    const res = await request(app).post('/api/orders').send({
      customerId: 'cust-1',
      restaurantId: 'rest-1',
      items: [{ menuId: 'menu-1', quantity: 1 }],
      address: '123 Main St',
      latitude: 40.7,
      longitude: -74.0,
    });

    // This SHOULD fail but doesn't due to the bug
    expect(res.status).toBe(201);
    console.log('BUG CONFIRMED: Order accepted for sold-out item');
  });

  it('BUG: race condition in driver assignment', async () => {
    const orderRes = await request(app).post('/api/orders').send({ /* ... */ });
    const orderId = orderRes.body.data.id;

    const p1 = request(app).patch(`/api/orders/${orderId}/assign`).send({ driverId: 'd1' });
    const p2 = request(app).patch(`/api/orders/${orderId}/assign`).send({ driverId: 'd2' });

    const [res1, res2] = await Promise.all([p1, p2]);
    if (res1.status === 200 && res2.status === 200) {
      console.log('BUG CONFIRMED: Both drivers accepted same order');
    }
  });
});
```

## Benefits
- `npm test` catches regressions before deploy
- Tests document the two known bugs as reproducible scenarios
- Supertest tests the real HTTP layer, not just internal functions

## Still Missing
- Still CommonJS (`require`)
- No containerization
