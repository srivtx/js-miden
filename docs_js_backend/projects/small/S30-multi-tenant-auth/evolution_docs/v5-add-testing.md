# v5-add-testing

## Goal
Prove registration, login, tenant isolation, and token validation.

## Changes
1. `vitest` + `supertest`.
2. Spin up Postgres with schema-per-tenant in Docker.
3. Test that tenant A cannot access tenant B's data.

## Code

```ts
// tests/auth.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { pool, initDb } from '../src/db.js';

describe('Multi-Tenant Auth', () => {
  beforeAll(async () => {
    await initDb();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('registers a user in tenant_a', async () => {
    const res = await request(app).post('/register').send({ email: 'alice@a.com', password: 'password123', tenantId: 'a' });
    expect(res.status).toBe(201);
    expect(res.body.tenantId).toBe('a');
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app).post('/login').send({ email: 'alice@a.com', password: 'wrong', tenantId: 'a' });
    expect(res.status).toBe(401);
  });

  it('isolates tenants', async () => {
    await request(app).post('/register').send({ email: 'alice@a.com', password: 'password123', tenantId: 'a' });
    const res = await request(app).post('/login').send({ email: 'alice@a.com', password: 'password123', tenantId: 'b' });
    expect(res.status).toBe(401); // user exists only in tenant_a
  });
});
```

## Decisions
- Real Postgres with schemas — mocks cannot catch schema isolation bugs.
- `initDb()` creates `tenant_a` and `tenant_b` schemas for tests.

## Risks
- Schema creation in tests requires superuser. Use a dedicated test DB user.
