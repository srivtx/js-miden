# S13 API Key Manager — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You add scope enforcement:

```ts
// middleware.ts
export function requireScope(scope: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const scopes = JSON.parse(req.apiKey?.scopes || '[]');
    if (!scopes.includes(scope)) {
      return res.status(403).json({ error: 'Insufficient scope' });
    }
    next();
  };
}
```

But you forget the case where `scopes` is `null` (meaning all scopes allowed):

```ts
// BEFORE — works for null
const scopes = req.apiKey?.scopes ? JSON.parse(req.apiKey.scopes) : ['*'];

// AFTER — "cleaner" but WRONG
const scopes = JSON.parse(req.apiKey?.scopes || '[]');
```

Now a key with `scopes = null` (all scopes) gets `[]` and is rejected from every endpoint. You deploy. All internal services break.

## The Fix: Write Tests BEFORE They Break

```ts
// tests/keys.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';

describe('S13 API Key Manager', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM api_keys').run();
  });

  it('generates a key and protects endpoints', async () => {
    const create = await request(app)
      .post('/keys')
      .send({ name: 'Test Key' });
    expect(create.status).toBe(201);

    const key = create.body.key;
    const res = await request(app)
      .get('/protected')
      .set('x-api-key', key);
    expect(res.status).toBe(200);
  });

  it('rejects invalid keys', async () => {
    const res = await request(app)
      .get('/protected')
      .set('x-api-key', 'pk_live_INVALID');
    expect(res.status).toBe(401);
  });

  it('enforces rate limits', async () => {
    const create = await request(app)
      .post('/keys')
      .send({ name: 'Limited', rate_limit: 2 });
    const key = create.body.key;

    await request(app).get('/protected').set('x-api-key', key);
    await request(app).get('/protected').set('x-api-key', key);
    const res = await request(app).get('/protected').set('x-api-key', key);
    expect(res.status).toBe(429);
  });

  it('allows null scopes (all access)', async () => {
    const create = await request(app)
      .post('/keys')
      .send({ name: 'Admin' });
    const key = create.body.key;

    const res = await request(app)
      .get('/protected')
      .set('x-api-key', key);
    expect(res.status).toBe(200);
  });

  it('rejects expired keys', async () => {
    const create = await request(app)
      .post('/keys')
      .send({ name: 'Expired', expires_in_days: -1 });
    const key = create.body.key;

    const res = await request(app)
      .get('/protected')
      .set('x-api-key', key);
    expect(res.status).toBe(401);
  });
});
```

**What tests prevent:**
- The null scopes regression? Caught.
- The rate limit enforcement? Caught.
- The expired key rejection? Caught.
- The invalid key hash comparison? Caught.

## The Pain That Remains

Your tests run with `vitest` but you're still using `require()` and `module.exports`. Modern Node.js supports ESM natively.

## What v6 Fixes

Switch to ESM. CommonJS is legacy.
