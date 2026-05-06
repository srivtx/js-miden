# MD10 Multi-Tenant Gateway — v7 Production Setup

> **Motto**: Isolate by default, trust by proof.

## What Changed

This is the full production-grade multi-tenant gateway:
- **Header-based isolation** — `X-Tenant-ID` header required on every request
- **JWT validation** — API keys are replaced with short-lived JWTs
- **RLS** — PostgreSQL Row Level Security policies enforce tenant isolation at the database level
- **Schema-per-tenant** — each tenant gets their own PostgreSQL schema for maximum isolation
- **Per-tenant rate limiting** — Redis-based rate limits per tenant, not global

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│   Express       │─────▶│  PostgreSQL     │
│  (Company)  │      │   Gateway       │      │  (RLS / Schema  │
└─────────────┘      │   + JWT         │      │   per tenant)   │
                     │   + Rate Limit  │      └─────────────────┘
                     └─────────────────┘               │
                              │                        │
                              ▼                        ▼
                       ┌──────────────┐      ┌─────────────────┐
                       │    Redis     │      │  Schema-per-    │
                       │  (Rate       │      │  tenant         │
                       │   Limits)    │      │  (isolated)     │
                       └──────────────┘      └─────────────────┘
```

## Code

### Header-Based Isolation

```typescript
// src/routes/gateway.ts
router.use((req, res, next) => {
  const apiKeyHeader = req.headers['x-api-key'] as string;
  const tenantIdHeader = req.headers['x-tenant-id'] as string;

  if (!apiKeyHeader || !tenantIdHeader) {
    res.status(401).json({ error: 'Missing API key or tenant ID' });
    return;
  }

  const keyHash = crypto.createHash('sha256').update(apiKeyHeader).digest('hex');
  const keyRecord = Array.from(apiKeys.values()).find(k => k.keyHash === keyHash);

  if (!keyRecord) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  // BUG (v1-6): We don't verify the tenant matches the API key
  // FIX (v7): Validate tenant matches key
  if (keyRecord.tenantId !== tenantIdHeader) {
    res.status(403).json({ error: 'Tenant does not match API key' });
    return;
  }

  const tenantId = tenantIdHeader;
  const tenant = tenants.get(tenantId);
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  (req as any).tenantId = tenantId;
  next();
});
```

### JWT Validation

```typescript
// src/middleware/jwt.ts
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export function jwtMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { tenantId: string; scopes: string[] };
    (req as any).tenantId = decoded.tenantId;
    (req as any).scopes = decoded.scopes;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

### RLS (Row Level Security)

```sql
-- migration/003_rls.sql
ALTER TABLE data ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON data
  USING (tenant_id = current_setting('app.current_tenant')::UUID);
```

```typescript
// src/db.ts
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function withTenant<T>(tenantId: string, fn: (client: Pool) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query(`SET app.current_tenant = '${tenantId}'`);
    return await fn(client as any);
  } finally {
    await client.query(`RESET app.current_tenant`);
    client.release();
  }
}
```

### Schema-Per-Tenant

```typescript
// src/db.ts
export async function getTenantSchema(tenantId: string): Promise<string> {
  return `tenant_${tenantId.replace(/-/g, '_')}`;
}

export async function createTenantSchema(tenantId: string) {
  const schema = await getTenantSchema(tenantId);
  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await pool.query(`CREATE TABLE IF NOT EXISTS "${schema}".data (...)`);
}
```

### Per-Tenant Rate Limiting

```typescript
// src/middleware/rateLimit.ts
import { config } from '../config.js';
import Redis from 'ioredis';

const redis = new Redis();

export async function rateLimitMiddleware(req: any, res: any, next: any) {
  const tenantId = req.tenantId || req.headers['x-tenant-id'];
  const key = `rate_limit:${tenantId}`;
  const windowMs = 60000;
  const limit = config.defaultRateLimit;

  const now = Date.now();
  const record = await redis.get(key);
  const data = record ? JSON.parse(record) : { count: 0, resetAt: now + windowMs };

  if (now > data.resetAt) {
    data.count = 1;
    data.resetAt = now + windowMs;
  } else if (data.count >= limit) {
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  } else {
    data.count++;
  }

  await redis.set(key, JSON.stringify(data), 'PX', windowMs);
  next();
}
```

## Decisions

**Isolation: RLS vs schema-per-tenant**
- Option A: RLS — single schema, database-enforced policies
- Option B: Schema-per-tenant — maximum isolation, harder to manage
- Option C: Shared schema + app filtering — easiest, least secure
- **Chosen: A for < 1k tenants, B for > 1k** — RLS is simpler; schema-per-tenant is more secure

**Auth: API keys vs JWT**
- Option A: API keys — simple, stateless
- Option B: JWT — short-lived, scoped, revocable
- **Chosen: B for production** — JWTs expire and can carry scopes

## Checklist

- [ ] Every request has a valid `X-Tenant-ID` header
- [ ] API key is validated and matches the tenant
- [ ] JWT tokens are short-lived (< 1 hour) and scoped
- [ ] PostgreSQL RLS policies are enabled on all tenant tables
- [ ] Schema-per-tenant is used for high-security tenants
- [ ] Rate limiting is per-tenant, not global
- [ ] All async operations have structured logging with `requestId`

## Post-Mortem: v7 Bugs

1. **Tenant from spoofable header** (fixed): API key is validated against the tenant
2. **Global rate limit** (fixed): Redis key includes `tenantId`
3. **No RLS** (fixed): PostgreSQL policies enforce isolation
4. **No JWT** (fixed): Short-lived tokens replace long-lived API keys

## Your Turn

- What happens if a tenant's schema migration fails halfway through?
- How would you implement cross-tenant analytics without breaking isolation?
- Should RLS policies be applied to all tables or only tenant-scoped tables?
