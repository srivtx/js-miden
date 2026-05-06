# Phase 2-3: Advanced Considerations

## Phase 2: Security & Isolation

### RLS Policies
```sql
-- Enable RLS on all tenant tables
ALTER TABLE data ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY tenant_isolation ON data
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- Set tenant in application
await db.query("SET app.current_tenant = $1", [tenantId]);
```

### Schema Strategies
- **Shared Schema**: One schema, tenant_id column. Best for <10k tenants.
- **Schema Per Tenant**: Better isolation, harder to manage. Good for <1k tenants.
- **Database Per Tenant**: Best isolation, highest overhead. Enterprise customers.

### API Gateway Pattern
- Kong, Tyk, or AWS API Gateway
- Centralized auth, rate limiting, logging
- Plugin ecosystem

## Phase 3: Compliance & Scale

### GDPR Deletion
- Right to be forgotten
- Cascade delete tenant data
- Audit trail of deletions
- 30-day retention after deletion request

### Usage Aggregation
- Real-time: Redis counters
- Historical: TimescaleDB or ClickHouse
- Billing: Stripe integration

### Feature Flags
- LaunchDarkly or Unleash
- A/B testing per tenant
- Gradual rollouts
