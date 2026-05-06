# MD10 Multi-Tenant Gateway — v2 Add TypeScript

> **Motto**: Types are the contract between tenants.

## What Changed

Migrated to TypeScript. Added `tsconfig.json`, interfaces for `Tenant`, `ApiKey`, and `UsageRecord`. Replaced the global array with typed Maps. Added strict null checks.

## Why

- **Tenant shapes are complex**: `Tenant` has `id`, `name`, `subdomain`, `features` — types prevent missing fields
- **Refactoring safety**: Renaming `tenantId` catches all references
- **Team velocity**: New engineers understand the data model without runtime exploration

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│  Express + TS   │─────▶│  In-Memory      │
│  (Company)  │◀─────│  (typed maps)   │◀─────│  Maps           │
└─────────────┘      └─────────────────┘      └─────────────────┘
```

## Code

```typescript
// src/types.ts
export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  createdAt: Date;
  features: Record<string, boolean>;
}

export interface ApiKey {
  id: string;
  tenantId: string;
  keyHash: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface UsageRecord {
  id: string;
  tenantId: string;
  endpoint: string;
  timestamp: Date;
  statusCode: number;
}

// src/server.ts
import express, { Request, Response } from 'express';
import { Tenant, ApiKey, UsageRecord } from './types.js';

const app = express();
app.use(express.json());

const tenants = new Map<string, Tenant>();
const apiKeys = new Map<string, ApiKey>();
const usageRecords = new Map<string, UsageRecord[]>();

app.post('/tenants', (req: Request, res: Response) => {
  const tenant: Tenant = {
    id: crypto.randomUUID(),
    name: req.body.name,
    subdomain: req.body.subdomain,
    createdAt: new Date(),
    features: {},
  };
  tenants.set(tenant.id, tenant);
  res.status(201).json(tenant);
});
```

## Decisions

**Option A: Inline types in handler**
- Pros: Fast to write
- Cons: No reuse, diverges across routes

**Option B: Shared `types.ts` file**
- Pros: Single source of truth
- Cons: Slight boilerplate

**Chosen: B** — `Tenant` is reused in gateway, admin, and billing routes.

## Problems We Accepted

- Still no tenant isolation — every user sees every company's data
- Still no auth — anyone can read or write
- Still no rate limiting

## Checklist

- [ ] `tsconfig.json` has `strict: true`
- [ ] All route handlers use explicit `Request` / `Response` types
- [ ] `Tenant` interface is shared between routes
- [ ] No `any` in the gateway flow

## Next Step

Add validation so bad tenant data fails before it reaches the database.
