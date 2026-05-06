# Architecture

## Overview

The Multi-tenant Gateway provides B2B API access with strict tenant isolation, per-tenant rate limiting, and usage tracking.

## Components

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Express   │────▶│  PostgreSQL  │
│  (Company)  │◀────│   Gateway   │◀────│  (Tenants,  │
└─────────────┘     └─────────────┘     │  API Keys)   │
                          │             └─────────────┘
                          │
                          ▼
                    ┌─────────────┐
                    │    Redis    │
                    │  (Rate      │
                    │  Limits)    │
                    └─────────────┘
```

## Tenant Isolation Strategies

### Row Level Security (RLS)
- PostgreSQL RLS policies on all tenant tables
- `CREATE POLICY tenant_isolation ON data USING (tenant_id = current_setting('app.current_tenant')::UUID);`
- Most secure, database-enforced

### Schema Per Tenant
- Each tenant gets own schema
- Good isolation, harder to manage at scale
- 10k tenants = 10k schemas

### Shared Schema with Tenant Column
- Single schema, tenant_id column on every table
- Application-level filtering (current bug: missing RLS)
- Easiest to manage, requires discipline

## Gateway Flow

1. Client sends request with `X-API-Key` and `X-Tenant-ID`
2. Gateway validates API key
3. Gateway verifies tenant matches API key (BUG: currently skipped)
4. Gateway checks per-tenant rate limit (BUG: currently global)
5. Gateway proxies to backend service
6. Usage recorded

## Feature Flags

Per-tenant feature toggles stored in `tenant.features` JSONB column.

```json
{
  "webhooks": true,
  "advanced_analytics": false,
  "custom_domains": true
}
```
