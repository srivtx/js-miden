# M35 Timezone API — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You switch to `Intl.DateTimeFormat` for DST support:

```ts
// BEFORE
export function convertTime(from: string, to: string, time: string): TimezoneConversion {
  const fromOffset = fixedOffsets[from];
  const toOffset = fixedOffsets[to];
  const offsetDiffHours = toOffset - fromOffset;
  // ...
}

// AFTER — "Intl API" but WRONG
export function convertTime(from: string, to: string, time: string): TimezoneConversion {
  const originalDate = new Date(time);
  const converted = new Date(originalDate.toLocaleString('en-US', { timeZone: to }));
  // BUG: ignores `from` timezone entirely
  return {
    from,
    to,
    originalTime: originalDate.toISOString(),
    convertedTime: converted.toISOString(),
    offset: 'unknown',
  };
}
```

Now `from=Asia/Tokyo` to `to=UTC` returns the same time because `toLocaleString` formats the original date in the target timezone, but it doesn't convert from a source timezone. The `from` parameter is ignored.

You deploy. Users in Tokyo see UTC times that are identical to their local times. Chaos.

## The Fix: Write Tests BEFORE They Break

```ts
// tests/timezone.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { convertTime } from '../src/timezone.js';

describe('M35 Timezone API', () => {
  it('converts UTC to Asia/Tokyo', async () => {
    const res = await request(app)
      .get('/convert')
      .query({ from: 'UTC', to: 'Asia/Tokyo', time: '2024-01-01T00:00:00Z' });
    expect(res.status).toBe(200);
    expect(res.body.convertedTime).toBe('2024-01-01T09:00:00.000Z');
  });

  it('lists supported timezones', async () => {
    const res = await request(app).get('/timezones');
    expect(res.status).toBe(200);
    expect(res.body.timezones).toContain('UTC');
    expect(res.body.timezones).toContain('Asia/Tokyo');
  });

  it('rejects unsupported timezone', async () => {
    const res = await request(app)
      .get('/convert')
      .query({ from: 'Mars/Space', to: 'UTC', time: '2024-01-01T00:00:00Z' });
    expect(res.status).toBe(400);
  });

  it('handles DST for America/New_York in summer', async () => {
    const result = convertTime('UTC', 'America/New_York', '2024-07-01T12:00:00Z');
    expect(result.convertedTime).toBe('2024-07-01T08:00:00.000Z');
  });

  it('handles DST for Europe/London in winter', async () => {
    const result = convertTime('UTC', 'Europe/London', '2024-01-15T12:00:00Z');
    expect(result.convertedTime).toBe('2024-01-15T12:00:00.000Z');
  });
});
```

**What tests prevent:**
- The `from` timezone being ignored? Caught.
- The DST regression for New York? Caught.
- The London winter offset being wrong? Caught.

## The Pain That Remains

Your tests run with `vitest` but you're still using `require()` and `module.exports`. Modern Node.js supports ESM natively.

## What v6 Fixes

Switch to ESM. CommonJS is legacy.
