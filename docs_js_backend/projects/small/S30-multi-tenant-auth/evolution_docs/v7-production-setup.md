# v7-production-setup

## Goal
Run a secure, multi-tenant auth service with tenant resolution, JWT claims, schema isolation, and RBAC.

## Changes
1. **Tenant resolution** — `x-tenant-id` header or subdomain.
2. **JWT claim** — `tenantId` and `role` embedded in token.
3. **Schema isolation** — Each tenant has its own Postgres schema.
4. **RBAC** — `requireRole('admin')` middleware checks token claim.
5. **Rate limiting** — Per IP + per tenant.
6. **Helmet** — Security headers.
7. **Graceful shutdown** — Close pool on SIGTERM.
8. **Structured logging** — `pino` with tenant context.

## Code

```ts
// src/services/tenant.ts
export function resolveTenant(req: any): string {
  return req.headers['x-tenant-id'] || req.subdomains[0] || 'default';
}
```

```ts
// src/middleware.ts
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as any).userId = decoded.userId;
    (req as any).tenantId = decoded.tenantId;
    (req as any).role = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if ((req as any).role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

export function requireTenant(req: Request, res: Response, next: NextFunction) {
  const requestTenant = req.headers['x-tenant-id'] || req.subdomains[0];
  const tokenTenant = (req as any).tenantId;
  if (requestTenant && requestTenant !== tokenTenant) {
    return res.status(403).json({ error: 'Tenant mismatch' });
  }
  (req as any).requestTenant = requestTenant;
  next();
}
```

```ts
// src/db.ts
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://tenantauth:tenantauth@localhost:5432/tenantauth',
});

export async function initDb() {
  const client = await pool.connect();
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS tenant_a;
    CREATE SCHEMA IF NOT EXISTS tenant_b;
    CREATE TABLE IF NOT EXISTS tenant_a.users (...);
    CREATE TABLE IF NOT EXISTS tenant_b.users (...);
  `);
  client.release();
}
```

```ts
// src/routes.ts
import { requireRole } from './middleware.js';

router.get('/admin/users', authenticate, requireTenant, requireRole('admin'), getAllUsers);
```

## Decisions
- **Schema isolation** over row-level security (RLS) — easier backup/restore per tenant, but more migration overhead.
- **JWT carries role** — avoids a DB lookup on every request. Trade-off: role changes require re-login or short token TTL.
- **Tenant mismatch check** prevents a user from tenant A using their token against tenant B's endpoints.

## Risks
- Schema proliferation — 10k tenants = 10k schemas. Consider DB-per-tenant or RLS for very high tenant counts.
- Dynamic schema names in SQL are prone to injection. Use a strict allow-list or parameterized schema resolution.
- JWT secret rotation requires grace period where old tokens are still accepted.

## ASCII: Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│   Express    │────▶│   Postgres  │
│ x-tenant-id │     │  Rate Limit  │     │ tenant_a.*  │
│ Bearer JWT  │     │  Helmet      │     │ tenant_b.*  │
└─────────────┘     └──────────────┘     └─────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │   JWT Claim  │
                       │ tenantId+role│
                       └──────────────┘
```
