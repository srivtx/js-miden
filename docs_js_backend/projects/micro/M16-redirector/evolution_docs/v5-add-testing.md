# M16 Redirector — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You add a feature: allow-list specific domains for your company. You refactor `isValidRedirectUrl`:

```ts
// BEFORE — works
export function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;
    if (!parsed.hostname) return false;
    return true;
  } catch {
    return false;
  }
}

// AFTER — "cleaner" but BROKEN
export function isValidRedirectUrl(url: string, allowedHosts?: string[]): boolean {
  const parsed = new URL(url);
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;
  if (allowedHosts && !allowedHosts.includes(parsed.hostname)) return false;
  return true; // Removed the empty hostname check!
}
```

Now `http://` (empty hostname) passes validation. Worse, you forgot `try/catch`. Invalid URLs crash the server with an unhandled exception.

You deploy. Within an hour, your error tracker is flooding with `TypeError [ERR_INVALID_URL]: Invalid URL`.

## The Fix: Tests as Safety Nets

```ts
// tests/app.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('M16 Simple Redirector', () => {
  it('POST /redirect returns 302 for valid HTTP URL', async () => {
    await request(app)
      .post('/redirect')
      .send({ url: 'https://example.com' })
      .expect(302)
      .expect('Location', 'https://example.com');
  });

  it('POST /redirect rejects javascript: URLs', async () => {
    const res = await request(app)
      .post('/redirect')
      .send({ url: "javascript:alert('xss')" })
      .expect(400);
    expect(res.body.error).toBe('Invalid or unsafe URL');
  });

  it('POST /redirect rejects data: URLs', async () => {
    const res = await request(app)
      .post('/redirect')
      .send({ url: "data:text/html,<script>alert(1)</script>" })
      .expect(400);
    expect(res.body.error).toBe('Invalid or unsafe URL');
  });

  it('POST /redirect rejects missing url', async () => {
    const res = await request(app).post('/redirect').send({}).expect(400);
    expect(res.body.error).toBe('Missing url in request body');
  });

  it('GET /info returns request headers', async () => {
    const res = await request(app)
      .get('/info')
      .set('X-Custom-Header', 'test')
      .expect(200);
    expect(res.body.headers['x-custom-header']).toBe('test');
    expect(res.body.method).toBe('GET');
  });
});
```

**What tests prevent:**
- Removing the `try/catch` around `new URL()`? Caught — `javascript:` without `//` throws.
- Removing hostname validation? Caught — `http://` would return 302 without a test failure.
- Changing the error message format? Caught — assertions on `res.body.error` fail.
- Breaking the `/info` endpoint? Caught.

## The Pain That Remains

Your tests import `{ app }` from `../src/app.js`, but `app.ts` still uses `require()`. Vitest handles both, but you're missing ESM benefits: tree shaking, top-level await, and alignment with the modern Node.js ecosystem.

## What v6 Fixes

Switch to ESM. CommonJS is legacy.
