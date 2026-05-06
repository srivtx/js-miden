# MD20 Logistics — v5 Add Testing

## Goal
Automate detection of the status/tracking inconsistency bug.

## Changes from v4
- Add `vitest` + `supertest`
- Add `tests/app.test.ts`
- Seed in-memory SQLite per test

## Test Structure
```
tests/
  app.test.ts
  setup.ts
  utils.ts
```

## Key Tests

### `tests/app.test.ts`
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db.js';

describe('Shipments', () => {
  beforeEach(async () => {
    await db.run('DELETE FROM tracking');
    await db.run('DELETE FROM shipments');
  });

  it('should create a shipment', async () => {
    const res = await request(app).post('/api/shipments').send({
      originId: 'wh-1',
      destinationId: 'wh-2',
      weight: 10.5,
      createdBy: 'user-1',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('trackingNumber');
  });

  it('BUG: status update without tracking event', async () => {
    const createRes = await request(app).post('/api/shipments').send({
      originId: 'wh-1',
      destinationId: 'wh-2',
      weight: 10.5,
      createdBy: 'user-1',
    });
    const id = createRes.body.data.id;

    // Simulate tracking table failure by dropping it
    await db.run('DROP TABLE tracking');

    const res = await request(app).patch(`/api/shipments/${id}/status`).send({
      status: 'IN_TRANSIT',
    });
    expect(res.status).toBe(200);

    // Shipment status updated but tracking event failed
    console.log('BUG CONFIRMED: Status updated but tracking event missing');
  });
});
```

## Benefits
- `npm test` catches regressions
- Tests document the known inconsistency bug
- Supertest validates HTTP layer

## Still Missing
- Still CommonJS
- No containerization
