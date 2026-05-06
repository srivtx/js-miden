# Data Model

## Tenants Table

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  features JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);
```

## API Keys Table

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  key_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP
);
```

## Usage Records Table

```sql
CREATE TABLE usage_records (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  endpoint VARCHAR(255),
  status_code INTEGER,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

## RLS Policies

```sql
-- Enable RLS
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;

-- Policy: tenants can only see their own data
CREATE POLICY tenant_isolation ON usage_records
  USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- Set tenant context
SET app.current_tenant = 'tenant-uuid';
```

## Redis Schema

### Rate Limits
```
Key: rate_limit:{tenantId}
Type: String (counter with expiration)
```
