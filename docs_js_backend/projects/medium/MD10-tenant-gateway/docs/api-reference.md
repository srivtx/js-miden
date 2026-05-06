# API Reference

## Authentication

Gateway endpoints require `X-API-Key` and `X-Tenant-ID` headers.

## Endpoints

### POST /api/tenants
Create a new tenant (company).

**Body:**
```json
{
  "name": "Acme Corp",
  "subdomain": "acme"
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Acme Corp",
  "subdomain": "acme"
}
```

### POST /api/tenants/:id/keys
Generate API key for tenant.

**Body:**
```json
{
  "name": "production-key"
}
```

**Response:**
```json
{
  "id": "uuid",
  "key": "tk_abc123...",
  "name": "production-key"
}
```

### GET /api/tenants/:id/usage
Get usage statistics for tenant.

### ANY /api/gateway/*
Proxy endpoint for tenant API requests.

**Headers:**
- `X-API-Key`: Valid API key
- `X-Tenant-ID`: Tenant identifier

**BUG:** Tenant ID from header is not validated against API key ownership.

### GET /api/features
Get feature flags for current tenant.
