# MD10 Multi-Tenant Gateway — v6 Switch to ESM

> **Motto**: ESM is the standard; CommonJS is legacy.

## What Changed

Converted the entire codebase from CommonJS (`require`, `module.exports`) to ESM (`import`, `export`). Updated `tsconfig.json` to `"module": "NodeNext"`, renamed imports to include `.js` extensions.

## Why

- **Tree-shaking**: Drops unused middleware under ESM
- **Top-level await**: `await redis.ping()` in module scope for health checks
- **Future-proof**: Node.js 20+ treats ESM as first-class

## Architecture

No architecture change — same boxes, better wires.

## Code

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

```json
// package.json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest"
  }
}
```

```typescript
// src/routes/gateway.ts
import { Router } from 'express';
import { tenants, apiKeys, usageRecords } from '../db.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import type { UsageRecord } from '../types.js';
import crypto from 'crypto';

const router = Router();

router.use(rateLimitMiddleware);

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

  const tenantId = tenantIdHeader;
  const tenant = tenants.get(tenantId);

  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  const record: UsageRecord = {
    id: crypto.randomUUID(),
    tenantId,
    endpoint: req.path,
    timestamp: new Date(),
    statusCode: 200,
  };
  const records = usageRecords.get(tenantId) || [];
  records.push(record);
  usageRecords.set(tenantId, records);

  (req as any).tenantId = tenantId;
  next();
});

export { router as gatewayRouter };
```

## Decisions

**Option A: Keep CommonJS, use dynamic import for ESM-only deps**
- Pros: Zero migration cost
- Cons: Fragmented codebase, loses top-level await

**Option B: Full ESM migration**
- Pros: Clean, consistent, future-proof
- Cons: Must add `.js` extensions to all relative imports

**Chosen: B** — the project is medium-sized; migration took 30 minutes.

## Problems We Accepted

- Some `@types/*` packages assume CommonJS; needed to update `tsconfig.json` `esModuleInterop`
- `__dirname` no longer exists; replaced with `fileURLToPath(import.meta.url)`
- Vitest config needed `globals: false` to avoid CJS interop issues

## Checklist

- [ ] `"type": "module"` is in `package.json`
- [ ] All relative imports end with `.js`
- [ ] `tsconfig.json` uses `"module": "NodeNext"`
- [ ] No `require()` or `module.exports` remains in `src/`
- [ ] Tests pass under ESM (vitest handles this natively)

## Next Step

Production setup: header-based isolation, JWT, RLS, and schema-per-tenant.
