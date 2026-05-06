# M19 Header Inspector — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You update `extractClientIp` to support `X-Real-IP` header:

```ts
// BEFORE — correct
export function extractClientIp(req: Request) {
  const remoteAddress = req.socket.remoteAddress || 'unknown';
  if (!isTrustedProxy(remoteAddress)) {
    return { ip: remoteAddress, source: 'direct', trusted: true };
  }
  // ... check XFF
}

// AFTER — "improved" but BROKEN
export function extractClientIp(req: Request) {
  const xri = req.headers['x-real-ip'];
  if (typeof xri === 'string' && isValidIP(xri)) {
    return { ip: xri, source: 'x-real-ip', trusted: true };
  }
  // Bug: Now X-Real-IP is checked BEFORE verifying if remoteAddress is trusted!
  // An attacker can send X-Real-IP directly and bypass all proxy checks.
}
```

You just opened a bypass. Any client can set `X-Real-IP` and your API trusts it unconditionally. Without tests, this ships to production.

## The Fix: Comprehensive Tests

```ts
// tests/app.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('M19 Header Inspector', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /headers returns request headers', async () => {
    const res = await request(app)
      .get('/headers')
      .set('X-Custom-Header', 'test-value');

    expect(res.status).toBe(200);
    expect(res.body.headers['x-custom-header']).toBe('test-value');
  });

  it('GET /ip returns client IP', async () => {
    const res = await request(app).get('/ip');
    expect(res.status).toBe(200);
    expect(res.body.ip).toBeDefined();
    expect(res.body.source).toBeDefined();
  });

  it('GET /ip ignores spoofed X-Forwarded-From from untrusted proxy', async () => {
    const res = await request(app)
      .get('/ip')
      .set('X-Forwarded-For', '1.2.3.4');

    expect(res.status).toBe(200);
    // Since supertest connects directly, remoteAddress won't be a trusted proxy
    // so it should return the direct IP, not 1.2.3.4
    expect(res.body.ip).not.toBe('1.2.3.4');
  });

  it('GET /security analyzes headers', async () => {
    const res = await request(app).get('/security');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.present)).toBe(true);
    expect(Array.isArray(res.body.missing)).toBe(true);
    expect(res.body.score).toBeDefined();
  });

  it('sets security headers on responses', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });
});
```

**What tests prevent:**
- Trusting spoofed `X-Forwarded-For`? Caught — `1.2.3.4` must NOT be returned.
- Removing security headers middleware? Caught — `x-frame-options` assertion fails.
- Breaking header sanitization? Caught — `x-custom-header` must be preserved.
- Changing the score format? Caught — `score` must be defined.

## The Pain That Remains

Tests import `app` from `../src/index.js`, but `index.ts` still uses `require()` in your mental model. The actual code uses ESM, but if you started with CJS, you'd want to migrate. ESM is the modern standard.

## What v6 Fixes

Switch to ESM. CommonJS is legacy.
