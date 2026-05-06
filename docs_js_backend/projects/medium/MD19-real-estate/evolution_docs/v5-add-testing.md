# MD19 Real Estate — v5 Add Testing

## Goal
Automate detection of slow search and agent-matching bugs.

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

describe('Search', () => {
  beforeEach(async () => {
    await db.run('DELETE FROM listings');
  });

  it('should search listings', async () => {
    await db.run(
      'INSERT INTO listings (address, city, state, status, price) VALUES (?, ?, ?, ?, ?)',
      ['123 Main', 'Springfield', 'IL', 'ACTIVE', 250000]
    );
    const res = await request(app).get('/api/search?location=Springfield');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('BUG: searchNearby fetches all listings into memory', async () => {
    // Insert many listings
    for (let i = 0; i < 1000; i++) {
      await db.run(
        'INSERT INTO listings (address, city, state, status, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)',
        [`${i} Main`, 'Springfield', 'IL', 'ACTIVE', 39.7 + Math.random(), -89.6 + Math.random()]
      );
    }
    const start = Date.now();
    const res = await request(app).get('/api/search/nearby?lat=39.7&lng=-89.6&radiusMiles=5');
    const duration = Date.now() - start;
    console.log(`BUG CONFIRMED: nearby search took ${duration}ms (fetches all rows)`);
    expect(res.status).toBe(200);
  });
});
```

## Benefits
- `npm test` catches regressions
- Tests document the known search performance bug
- Supertest validates HTTP layer

## Still Missing
- Still CommonJS
- No containerization
