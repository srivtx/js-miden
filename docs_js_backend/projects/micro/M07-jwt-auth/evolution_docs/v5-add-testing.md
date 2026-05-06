# v5-add-testing.md — "I broke the health endpoint adding auth"

## The Bug

You add token expiry checking. But in your haste, you write:

```ts
const decoded = jwt.verify(token, SECRET, {
  algorithms: ['HS256'],
  ignoreExpiration: true,
});
```

`ignoreExpiration: true`.

A stolen token from six months ago is still valid. An attacker who compromised a user's account retains access forever. You don't notice until a former employee's token is used to access admin endpoints.

You didn't test token expiry.

## The 3am Page, Redux

You add refresh tokens. The login endpoint now returns both `accessToken` and `refreshToken`. You update the frontend to use the refresh token. But the `/protected` endpoint still checks `Authorization: Bearer <accessToken>`. The frontend sends the refresh token by mistake. The server verifies it with `jwt.verify` — it passes because both tokens use the same secret and algorithm. The server grants access based on a refresh token.

Refresh tokens are supposed to be single-use and stored in a database. You're treating them like access tokens.

You didn't test that refresh tokens can't access protected routes.

## Adding Vitest + Supertest

```bash
npm install -D vitest supertest @types/supertest
```

```ts
// tests/auth.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/server.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

describe('JWT Auth', () => {
  it('returns a token on valid login', async () => {
    const res = await request(app)
      .post('/login')
      .send({ userId: 'alice' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });

  it('returns 401 with an invalid token', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
  });

  it('returns 401 with an expired token', async () => {
    const expiredToken = jwt.sign({ sub: 'alice' }, SECRET, {
      expiresIn: '-1h',
      algorithm: 'HS256',
    });

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
  });

  it('returns 200 with a valid token', async () => {
    const validToken = jwt.sign({ sub: 'alice' }, SECRET, {
      expiresIn: '1h',
      algorithm: 'HS256',
    });

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Access granted');
  });

  it('rejects a token with the wrong algorithm', async () => {
    const weakToken = jwt.sign({ sub: 'alice' }, SECRET, {
      expiresIn: '1h',
      algorithm: 'none',
    });

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${weakToken}`);

    expect(res.status).toBe(401);
  });
});
```

Run the tests:

```bash
npm test
```

The "expired token" test fails. The server returns 200 because `ignoreExpiration: true`. The test caught the bug.

The "wrong algorithm" test fails if you don't specify `algorithms: ['HS256']`. Without it, `jwt.verify` accepts `alg: none` attacks.

## Why Tests?

- **They test security properties.** Not just "does it work" but "does it reject the things that should be rejected."
- **They test expiry.** Time-based bugs are impossible to catch manually.
- **They test algorithms.** Cryptographic misconfigurations are subtle.
- **They prevent regressions.** Add refresh tokens? Test that they can't access protected routes.

## What Changed

- Added Vitest and Supertest as dev dependencies
- Tests cover valid login, missing token, invalid token, expired token, valid token, and algorithm mismatch
- Tests use `jwt.sign` to create tokens with specific properties
- Tests run in CI with `npm test`

## What We Still Need

Tests verify behavior. But our module system is CommonJS. Node.js 20+ prefers ESM. We need to modernize.

For that, we need to switch to ESM.
