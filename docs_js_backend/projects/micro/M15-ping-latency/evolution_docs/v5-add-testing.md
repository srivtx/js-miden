# M15 Ping API — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You refactor `latency.ts` to support IPv6. In the process, you change the port parsing:

```ts
// BEFORE
const port = Number(target.split(':')[1]) || 80;

// AFTER — "cleaner" but WRONG for IPv6
const port = target.includes(':') ? Number(target.split(':').pop()) : 80;
```

Now `target=::1` parses port as `1` instead of rejecting the host entirely. Worse, you removed `localhost` from `BLOCKED_HOSTS` because you thought the regex covered it. It doesn't.

You deploy on Friday. Monday morning: security incident. SSRF via `localhost:3000/admin`.

## The Fix: Write Tests BEFORE They Break

```ts
// tests/app.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('M15 Ping API', () => {
  it('GET /ping returns pong with timestamp', async () => {
    const res = await request(app).get('/ping').expect(200);
    expect(res.body.message).toBe('pong');
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });

  it('GET /latency without target returns 400', async () => {
    await request(app).get('/latency').expect(400);
  });

  it('GET /latency blocks localhost', async () => {
    const res = await request(app)
      .get('/latency?target=localhost')
      .expect(403);
    expect(res.body.error).toContain('blocked');
  });

  it('GET /latency blocks 127.0.0.1', async () => {
    const res = await request(app)
      .get('/latency?target=127.0.0.1')
      .expect(403);
    expect(res.body.error).toContain('blocked');
  });

  it('GET /latency blocks private IP 192.168.1.1', async () => {
    const res = await request(app)
      .get('/latency?target=192.168.1.1')
      .expect(403);
    expect(res.body.error).toContain('blocked');
  });
});
```

**What tests prevent:**
- The `localhost` block regression? Caught.
- The missing `target` parameter crash? Caught.
- Changing the status code from 403 to 500? Caught.
- Breaking the `/ping` timestamp format? Caught.

## The Pain That Remains

Your tests run with `vitest` but you're still using `require()` and `module.exports`. Modern Node.js supports ESM natively. You're missing out on top-level await, tree shaking, and explicit dependency graphs. Plus, `__dirname` hacks are annoying.

## What v6 Fixes

Switch to ESM. CommonJS is legacy.
