# M18 Timezone API — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You refactor `getCurrentTime` to use a "simpler" DST check:

```ts
// BEFORE — compares Jan vs Jul offset
const janOffset = getOffsetMinutes(timezone, new Date(Number(year), 0, 1));
const julOffset = getOffsetMinutes(timezone, new Date(Number(year), 6, 1));
const currentOffset = getOffsetMinutes(timezone, now);
const isDST = Math.max(janOffset, julOffset) !== currentOffset;

// AFTER — "simpler" but WRONG for southern hemisphere
const isDST = currentOffset > janOffset;
```

Now `Australia/Sydney` (southern hemisphere) shows `isDST: false` in January (summer) when it should be `true`. DST is active in January for Sydney. Your "simplification" assumed DST is always in northern summer.

You deploy. Australian users are confused. You don't have tests for southern hemisphere DST.

## The Fix: Comprehensive Tests

```ts
// tests/app.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('M18 Timezone API', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /time/:timezone returns time for valid zone', async () => {
    const res = await request(app).get('/time/Asia/Tokyo');
    expect(res.status).toBe(200);
    expect(res.body.timezone).toBe('Asia/Tokyo');
    expect(res.body.currentTime).toContain('+09:00');
    expect(typeof res.body.isDST).toBe('boolean');
  });

  it('GET /time/:timezone rejects invalid zone', async () => {
    const res = await request(app).get('/time/Invalid/Zone');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid timezone');
  });

  it('GET /convert converts time between zones', async () => {
    const res = await request(app)
      .get('/convert')
      .query({ from: 'UTC', to: 'America/New_York', time: '2024-06-15T14:00:00Z' });

    expect(res.status).toBe(200);
    expect(res.body.from).toBe('UTC');
    expect(res.body.to).toBe('America/New_York');
    expect(res.body.convertedTime).toContain('-04:00'); // EDT in June
  });

  it('GET /convert rejects missing parameters', async () => {
    const res = await request(app).get('/convert').query({ from: 'UTC' });
    expect(res.status).toBe(400);
  });

  it('GET /convert rejects invalid time format', async () => {
    const res = await request(app)
      .get('/convert')
      .query({ from: 'UTC', to: 'Asia/Tokyo', time: 'not-a-date' });
    expect(res.status).toBe(400);
  });
});
```

**What tests prevent:**
- Breaking Tokyo offset? Caught — `+09:00` assertion fails.
- Removing timezone validation? Caught — `Invalid/Zone` returns 400.
- Breaking conversion math? Caught — `-04:00` for June NY fails if DST breaks.
- Accepting garbage time input? Caught — `not-a-date` must return 400.

## The Pain That Remains

Your tests import `app` from ESM files, but you're still using `require()` in some helper scripts. Modern Node.js is ESM-first. Time to switch fully.

## What v6 Fixes

Switch to ESM. CommonJS is legacy.
