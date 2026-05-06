# M30 Bulkhead — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You refactor `bulkhead.ts` to support dynamic pool creation:

```ts
// BEFORE
const pools: Record<string, Pool> = {
  critical: new Pool('critical', 10),
  background: new Pool('background', 5),
};

// AFTER — "flexible" but WRONG
createPool('critical', 3); // oops, copy-pasted from background
```

Now the critical pool has capacity 3 instead of 10. Under normal load, critical requests are rejected. Worse, you accidentally made all pools share a single counter:

```ts
// BUG: shared active counter
let globalActive = 0;

class Pool {
  constructor(private name: string, private max: number) {}
  hasCapacity() { return globalActive < this.max; }
  acquire() { globalActive++; }
  release() { globalActive--; }
}
```

Now critical and background share state again. The bulkhead is broken.

You deploy on Friday. Monday morning: outage report. Critical user requests are failing.

## The Fix: Write Tests BEFORE They Break

```ts
// tests/bulkhead.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { getPoolStatus } from '../src/bulkhead.js';

describe('Bulkhead Pattern', () => {
  it('should allow requests within pool limit', async () => {
    const res = await request(app).get('/critical');
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('critical');
  });

  it('should reject when pool is full', async () => {
    const promises = Array.from({ length: 11 }, () => request(app).get('/background'));
    const results = await Promise.all(promises);
    const rejections = results.filter(r => r.status === 503).length;
    expect(rejections).toBeGreaterThanOrEqual(1);
  });

  it('should isolate critical from background', async () => {
    const bgPromises = Array.from({ length: 5 }, () => request(app).get('/background'));
    await new Promise(r => setTimeout(r, 50));
    const critical = await request(app).get('/critical');
    await Promise.all(bgPromises);
    expect(critical.status).toBe(200);
  });

  it('should not leak pool slots', async () => {
    await request(app).get('/critical');
    const status = getPoolStatus('critical');
    expect(status.active).toBe(0);
  });
});
```

**What tests prevent:**
- The shared pool regression? Caught.
- The wrong capacity copy-paste? Caught.
- Slot leaks from missing `finally`? Caught.

## The Pain That Remains

Your tests run with `vitest` but you're still using `require()` and `module.exports`. Modern Node.js supports ESM natively. You're missing out on top-level await, tree shaking, and explicit dependency graphs.

## What v6 Fixes

Switch to ESM. CommonJS is legacy.
