# v5-add-testing

## Goal
Prove shortening, redirects, expiry, and analytics are correct.

## Changes
1. `vitest` + `supertest`.
2. Spin up Postgres in `docker-compose` for integration tests.
3. Mock `nanoid` for deterministic custom codes.

## Code

```ts
// tests/shortener.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { pool, initDb } from '../src/db.js';

describe('URL Shortener', () => {
  beforeAll(async () => {
    await initDb();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('shortens a valid URL', async () => {
    const res = await request(app).post('/shorten').send({ url: 'https://example.com' });
    expect(res.status).toBe(201);
    expect(res.body.shortCode).toBeDefined();
  });

  it('rejects a non-HTTP URL', async () => {
    const res = await request(app).post('/shorten').send({ url: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
  });

  it('returns 410 for expired short code', async () => {
    const create = await request(app).post('/shorten').send({ url: 'https://old.com', expiresInDays: -1 });
    const res = await request(app).get(`/${create.body.shortCode}`);
    expect(res.status).toBe(410);
  });
});
```

## Decisions
- Use real Postgres in tests — catches schema mismatches and SQL syntax errors that mocks hide.
- Clean tables in `beforeAll` so tests are idempotent.

## Risks
- Test suite requires Docker. Document `docker compose up -d db` in README.
