# MD10 Multi-Tenant Gateway — v3 Add Validation

> **Motto**: Validate before you isolate.

## What Changed

Added `zod` schemas for tenants, API keys, and usage records. Validation runs before any database write. Invalid subdomains, missing names, or malformed API keys return `400` with a clear error message.

## Why

- **UX**: A malformed subdomain breaks routing; validation prevents it
- **Security**: Prevents injection via `name` or `subdomain` fields
- **Contract**: The zod schema *is* the API contract

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│     Zod         │─────▶│  In-Memory      │
│  (Company)  │◀─────│  (validate)     │◀─────│  Maps           │
└─────────────┘      └─────────────────┘      └─────────────────┘
                            │
                            ▼ (400 Bad Request)
                     ┌─────────────────┐
                     │  Clear error    │
                     │  { field, msg } │
                     └─────────────────┘
```

## Code

```typescript
// src/validators/tenants.ts
import { z } from 'zod';

export const tenantSchema = z.object({
  name: z.string().min(1).max(100),
  subdomain: z.string().min(1).max(63).regex(/^[a-z0-9-]+$/),
});

export const apiKeySchema = z.object({
  name: z.string().min(1).max(50).optional(),
});

export type TenantInput = z.infer<typeof tenantSchema>;

// src/middleware/validate.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        issues: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

// src/routes/tenants.ts
import { tenantSchema } from '../validators/tenants.js';
import { validateBody } from '../middleware/validate.js';

router.post('/', validateBody(tenantSchema), (req: Request, res: Response) => {
  const { name, subdomain } = req.body;
  const tenant: Tenant = {
    id: crypto.randomUUID(),
    name,
    subdomain,
    createdAt: new Date(),
    features: {},
  };
  tenants.set(tenant.id, tenant);
  res.status(201).json({ id: tenant.id, name, subdomain });
});
```

## Decisions

**Option A: Joi**
- Pros: Mature, expressive error messages
- Cons: Larger bundle, different syntax

**Option B: Zod**
- Pros: Native TypeScript inference, smaller footprint, great DX
- Cons: Slightly less flexible custom messages

**Chosen: Zod** — inferring `TenantInput` from the schema eliminates drift.

## Problems We Accepted

- Validation is only at creation; no runtime isolation yet
- No auth or rate limiting
- No subdomain uniqueness check

## Checklist

- [ ] Every `POST` / `PUT` route has a zod schema
- [ ] `subdomain` is alphanumeric with hyphens only
- [ ] `name` is bounded to 100 characters
- [ ] Validation middleware runs before auth (fail fast on garbage)

## Next Step

Add structured logging so we can trace tenant requests and usage.
