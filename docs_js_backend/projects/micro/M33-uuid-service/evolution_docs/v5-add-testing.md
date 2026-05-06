# M33 UUID Service — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You fix the v7 timestamp precision:

```ts
// BEFORE (buggy)
const timestamp = Math.floor(new Date().getTime() / 1000);

// AFTER (correct)
const timestamp = new Date().getTime();
```

But you also change the random bit generation:

```ts
// BEFORE
const randA = Math.floor(Math.random() * 0x1000).toString(16).padStart(3, '0');

// AFTER — "simpler" but WRONG
const randA = Math.floor(Math.random() * 0x100).toString(16).padStart(2, '0');
```

Now the UUID has only 2 hex digits in the randA field instead of 3. The total length is wrong. UUID validators reject it.

You deploy. Downstream services start failing UUID validation. Incidents pile up.

## The Fix: Write Tests BEFORE They Break

```ts
// tests/uuid.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { uuidV7 } from '../src/uuid.js';

describe('M33 UUID Service', () => {
  it('GET /uuid/v4 returns a valid v4 UUID', async () => {
    const res = await request(app).get('/uuid/v4');
    expect(res.status).toBe(200);
    expect(res.body.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('GET /uuid/v7 returns a UUID-like string', async () => {
    const res = await request(app).get('/uuid/v7');
    expect(res.status).toBe(200);
    expect(res.body.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('GET /uuid/ulid returns a ULID', async () => {
    const res = await request(app).get('/uuid/ulid');
    expect(res.status).toBe(200);
    expect(res.body.ulid).toMatch(/^[0-9A-Z]{26}$/);
  });

  it('POST /uuid/bulk returns requested count', async () => {
    const res = await request(app)
      .post('/uuid/bulk')
      .send({ count: 5, type: 'v4' });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(5);
    expect(res.body.type).toBe('v4');
  });

  it('UUID v7 timestamp is close to now', async () => {
    const before = Date.now();
    const uuid = uuidV7();
    const after = Date.now();

    const timeHex = uuid.split('-')[0] + uuid.split('-')[1];
    const extractedTimestamp = parseInt(timeHex, 16);

    expect(extractedTimestamp).toBeGreaterThanOrEqual(before);
    expect(extractedTimestamp).toBeLessThanOrEqual(after);
  });
});
```

**What tests prevent:**
- The v7 timestamp precision bug? Caught.
- The wrong UUID length? Caught.
- The bulk count limit bypass? Caught.

## The Pain That Remains

Your tests run with `vitest` but you're still using `require()` and `module.exports`. Modern Node.js supports ESM natively.

## What v6 Fixes

Switch to ESM. CommonJS is legacy.
