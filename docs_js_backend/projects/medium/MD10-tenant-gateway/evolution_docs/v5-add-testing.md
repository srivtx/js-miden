# MD10 Multi-Tenant Gateway — v5 Add Testing

> **Motto**: Test the gateway before the tenants do.

## What Changed

Added `vitest` + `supertest`. Unit tests for validators, service tests for tenant isolation, and integration tests for the full API key → gateway flow.

## Why

- **Security**: A broken gateway leaks data between tenants
- **Refactoring**: v6 (ESM) and v7 (RLS, schema-per-tenant) will touch every file — tests prove nothing broke
- **Documentation**: Tests show the intended behavior better than prose

## Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Vitest        │─────▶│   Supertest     │─────▶│   Express App   │
│   (runner)      │      │   (HTTP client) │      │   (in-memory)   │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

## Code

```typescript
// tests/gateway.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('POST /tenants', () => {
  it('creates a tenant with valid data', async () => {
    const res = await request(app)
      .post('/tenants')
      .send({ name: 'Acme Corp', subdomain: 'acme' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Acme Corp');
  });

  it('rejects invalid subdomains', async () => {
    const res = await request(app)
      .post('/tenants')
      .send({ name: 'Acme Corp', subdomain: 'acme corp' })
      .expect(400);

    expect(res.body.issues).toContainEqual(
      expect.objectContaining({ field: 'subdomain' })
    );
  });
});

describe('Gateway', () => {
  it('proxies requests with valid API key', async () => {
    const tenantRes = await request(app)
      .post('/tenants')
      .send({ name: 'Test', subdomain: 'test' })
      .expect(201);

    const keyRes = await request(app)
      .post(`/tenants/${tenantRes.body.id}/keys`)
      .expect(201);

    const res = await request(app)
      .get('/api/data')
      .set('x-api-key', keyRes.body.key)
      .set('x-tenant-id', tenantRes.body.id)
      .expect(200);

    expect(res.body.tenantId).toBe(tenantRes.body.id);
  });

  it('rejects requests without API key', async () => {
    const res = await request(app)
      .get('/api/data')
      .set('x-tenant-id', 'some-id')
      .expect(401);

    expect(res.body.error).toContain('Missing API key');
  });
});
```

## Decisions

**Option A: Jest**
- Pros: Ubiquitous, snapshot testing
- Cons: ESM support is painful, slower

**Option B: Vitest**
- Pros: Native ESM, Jest-compatible API, fast
- Cons: Smaller ecosystem

**Chosen: Vitest** — aligns with v6 ESM switch.

## Problems We Accepted

- Gateway tests require seeding tenants and API keys; no database cleanup between tests
- No load tests yet
- RLS logic is not yet tested

## Checklist

- [ ] All routes have at least one happy-path and one error test
- [ ] Zod validation failures are tested with precise error shapes
- [ ] Gateway auth is tested (valid key, missing key, invalid key)
- [ ] Tests run in < 5 seconds for the entire suite
- [ ] Coverage report is generated; target 80%+ for services

## Next Step

Switch to ESM so we can use top-level await and tree-shake.
