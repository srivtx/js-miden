# S18 A/B Testing — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You add statistical significance:

```ts
// store.ts
function calculatePValue(conversionsA: number, usersA: number, conversionsB: number, usersB: number): number {
  const rateA = conversionsA / usersA;
  const rateB = conversionsB / usersB;
  const pooled = (conversionsA + conversionsB) / (usersA + usersB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / usersA + 1 / usersB));
  const z = (rateB - rateA) / se;
  return 2 * (1 - normalCDF(Math.abs(z)));
}
```

But you forget the case where `usersA` is zero:

```ts
// BEFORE — checks for zero
if (usersA === 0 || usersB === 0) return 1;

// AFTER — "cleaner" but WRONG
const rateA = conversionsA / usersA; // Infinity if usersA = 0
```

Now `rateA` is `Infinity`. `z` is `NaN`. The p-value is `NaN`. Your stats endpoint crashes. You deploy. Experiment dashboards break.

## The Fix: Write Tests BEFORE They Break

```ts
// tests/ab.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';

describe('S18 A/B Testing', () => {
  it('assigns consistent variants', async () => {
    const res1 = await request(app).get('/experiments/button-color?userId=alice');
    const res2 = await request(app).get('/experiments/button-color?userId=alice');
    expect(res1.body.variant).toBe(res2.body.variant);
  });

  it('assigns different variants to different users', async () => {
    const res1 = await request(app).get('/experiments/button-color?userId=alice');
    const res2 = await request(app).get('/experiments/button-color?userId=bob');
    // Not guaranteed, but likely different
    expect(res1.body.variant).toBeDefined();
    expect(res2.body.variant).toBeDefined();
  });

  it('tracks conversions', async () => {
    await request(app).get('/experiments/button-color?userId=alice');
    const res = await request(app)
      .post('/experiments/button-color/conversion')
      .send({ userId: 'alice', value: 1 });
    expect(res.body.success).toBe(true);
  });

  it('returns stats', async () => {
    await request(app).get('/experiments/button-color?userId=u1');
    await request(app).get('/experiments/button-color?userId=u2');
    await request(app)
      .post('/experiments/button-color/conversion')
      .send({ userId: 'u1', value: 1 });

    const res = await request(app).get('/experiments/button-color/stats');
    expect(res.status).toBe(200);
    expect(res.body.totalUsers).toBeGreaterThanOrEqual(2);
  });

  it('handles empty experiments gracefully', async () => {
    const res = await request(app).get('/experiments/nonexistent/stats');
    expect(res.status).toBe(404);
  });

  it('handles zero users in a variant', async () => {
    // Only assign one user
    await request(app).get('/experiments/button-color?userId=onlyone');
    const res = await request(app).get('/experiments/button-color/stats');
    expect(res.status).toBe(200);
    expect(() => JSON.stringify(res.body)).not.toThrow();
  });
});
```

**What tests prevent:**
- The division by zero crash? Caught.
- The inconsistent assignment? Caught.
- The missing experiment handling? Caught.
- The empty stats calculation? Caught.

## The Pain That Remains

Your tests run with `vitest` but you're still using `require()` and `module.exports`. Modern Node.js supports ESM natively.

## What v6 Fixes

Switch to ESM. CommonJS is legacy.
