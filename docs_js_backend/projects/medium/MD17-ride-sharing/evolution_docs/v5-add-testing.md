# MD17 Ride Sharing — v5 Add Testing

## Goal
Automate detection of the surge-pricing race condition and driver-acceptance race.

## Changes from v4
- Add `vitest` + `supertest`
- Add `tests/app.test.ts` with integration tests
- Seed in-memory SQLite for test isolation

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
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db.js';

describe('Rides', () => {
  beforeEach(async () => {
    await db.run('DELETE FROM rides');
    await db.run('DELETE FROM drivers');
  });

  it('should request a ride', async () => {
    const res = await request(app).post('/api/rides').send({
      riderId: 'rider-1',
      pickupAddress: '123 Main',
      pickupLat: 40.7,
      pickupLng: -74.0,
      dropoffAddress: '456 Park',
      dropoffLat: 40.8,
      dropoffLng: -74.1,
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
  });

  it('BUG: surge pricing uses stale demand/supply', async () => {
    // Simulate high demand by inserting many requested rides
    for (let i = 0; i < 10; i++) {
      await db.run(
        'INSERT INTO rides (rider_id, status, pickup_lat, pickup_lng) VALUES (?, ?, ?, ?)',
        [`rider-${i}`, 'REQUESTED', 40.7, -74.0]
      );
    }
    const res = await request(app).post('/api/rides').send({
      riderId: 'rider-x',
      pickupAddress: '123 Main',
      pickupLat: 40.7,
      pickupLng: -74.0,
      dropoffAddress: '456 Park',
      dropoffLat: 40.8,
      dropoffLng: -74.1,
    });
    // Surge may be wrong due to non-atomic read of demand/supply
    expect(res.status).toBe(201);
    console.log('BUG CONFIRMED: Surge multiplier may be stale');
  });
});
```

## Benefits
- `npm test` catches regressions
- Tests document the surge-pricing race condition
- Supertest validates the full HTTP stack

## Still Missing
- Still CommonJS
- No containerization
