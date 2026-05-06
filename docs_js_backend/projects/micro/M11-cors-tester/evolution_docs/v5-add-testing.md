# v5-add-testing.md — CORS Tester

## The Pain

We added origin validation (v3) and logging (v4), but a "quick fix" for a partner integration broke security:

```typescript
// "Quick fix": allow all subdomains of example.com
const ALLOWED_ORIGINS = ['https://app.example.com'];

const privateCors = cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.example.com')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed'));
    }
  },
  credentials: true,
});
```

Looks safe? An attacker registered `evil-example.com`. It ends with `.example.com` (well, no — but `attacker.example.com.evil.com` does). The check was naive string matching.

We had no tests for origin spoofing. The vulnerability shipped.

## The Fix: Add Tests

```typescript
// tests/cors.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('GET /public', () => {
  it('should allow any origin without credentials', async () => {
    const res = await request(app).get('/public').set('Origin', 'https://evil.com');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});

describe('GET /private', () => {
  it('should require authorization', async () => {
    const res = await request(app).get('/private');
    expect(res.status).toBe(401);
  });

  it('should NOT use wildcard origin when credentials are enabled', async () => {
    const res = await request(app)
      .get('/private')
      .set('Origin', 'https://evil.com')
      .set('Authorization', 'Bearer secret-token');

    // THIS ASSERTION FAILS DUE TO THE BUG:
    // cors({ origin: '*', credentials: true }) sends Access-Control-Allow-Origin: *
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('should handle preflight for private route', async () => {
    const res = await request(app)
      .options('/private')
      .set('Origin', 'https://app.example.com')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'Authorization');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-methods']).toContain('GET');
  });
});
```

## What Tests Caught

1. **Wildcard + credentials:** The test explicitly asserts `not.toBe('*')`. If someone reverts to `origin: '*'`, the test fails.
2. **Preflight handling:** OPTIONS requests must return correct headers. Without tests, preflight regressions go unnoticed.
3. **Origin spoofing:** Additional tests for `attacker.example.com.evil.com` would catch naive string matching.

## But Tests Don't Fix CORS Logic

Tests verify behavior, but they can't enumerate every possible origin spoofing attack. The CORS policy itself must be implemented with URL parsing, not string matching (see v7).

> **Lesson:** CORS tests are critical because CORS bugs are invisible in curl and only manifest in browsers. Tests simulate browser behavior.
