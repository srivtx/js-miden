# MD10 Multi-Tenant Gateway — v4 Add Logging

> **Motto**: Log every tenant request.

## What Changed

Replaced `console.log` with `pino` structured JSON logging. Every gateway request gets a `requestId`. Tenant creation, API key usage, and rate limit events are logged. Added correlation IDs across async boundaries.

## Why

- **Billing**: Finance needs per-tenant request counts for invoicing
- **Debugging**: A tenant says "my requests are failing" — search by `tenantId` to see the exact flow
- **Alerting**: Log-based metrics (`gateway.error` > 5/min) trigger PagerDuty
- **Compliance**: Some industries require audit trails for B2B API access

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│   Express       │─────▶│  In-Memory      │
│  (Company)  │      │  + pino logger  │      │  Maps           │
└─────────────┘      └────────┬────────┘      └─────────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │  stdout /    │
                       │  log shipper │
                       └──────────────┘
```

## Code

```typescript
// src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'tenant-gateway' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// src/routes/gateway.ts
import { logger } from '../utils/logger.js';

router.use((req, res, next) => {
  const requestId = (req as any).requestId;
  const log = logger.child({ requestId, route: req.path });

  const apiKeyHeader = req.headers['x-api-key'] as string;
  const tenantIdHeader = req.headers['x-tenant-id'] as string;

  log.info({ tenantId: tenantIdHeader, apiKeyPrefix: apiKeyHeader?.slice(0, 8) }, 'Gateway request received');
  // ... validation
  next();
});

// src/routes/tenants.ts
router.post('/', validateBody(tenantSchema), (req: Request, res: Response) => {
  const { name, subdomain } = req.body;
  logger.info({ name, subdomain }, 'Tenant created');
  // ...
});
```

## Decisions

**Option A: Winston**
- Pros: Transports, formatting
- Cons: Slower, heavier config

**Option B: Pino**
- Pros: Fast, structured by default, ESM-friendly
- Cons: Fewer built-in transports

**Chosen: Pino** — we ship logs to stdout and let the platform handle aggregation.

## Problems We Accepted

- Logs are stdout-only; no log aggregation configured yet
- No automatic redaction of API keys
- No per-tenant log filtering

## Checklist

- [ ] `logger.child()` is used per-request so `requestId` is in every log line
- [ ] Tenant creation logs name and subdomain (not API keys)
- [ ] Gateway requests log tenant ID and endpoint
- [ ] Error logs include the full error object and request context

## Next Step

Add tests so we can refactor safely.
