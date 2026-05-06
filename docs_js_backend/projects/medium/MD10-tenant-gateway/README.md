# MD10: Multi-tenant Gateway

B2B API platform with tenant isolation, API keys, and usage tracking.

## Quick Start

```bash
docker-compose up -d
npm install
npm run dev
```

## API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/tenants | POST | Create tenant |
| /api/tenants/:id/keys | POST | Generate API key |
| /api/gateway/* | ANY | Proxied API requests |
| /api/usage | GET | Usage statistics |
| /api/features | GET | Feature flags |

## Architecture

- **Tenant Isolation**: PostgreSQL RLS policies
- **Authentication**: API keys with HMAC validation
- **Rate Limiting**: Per-tenant Redis counters
- **Feature Flags**: Tenant-specific feature toggles

## Known Issues (for debugging practice)

1. **BUG**: Tenant ID from header is spoofable (not validated against API key)
2. **BUG**: No per-tenant rate limiting (one tenant can exhaust all resources)

## Documentation

See `/docs` for full architecture, API reference, and troubleshooting guides.

## Testing

```bash
npm test
```

Tests include failing tests that reproduce the known bugs.
