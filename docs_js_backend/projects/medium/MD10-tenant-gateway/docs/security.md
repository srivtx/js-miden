# Security

## Authentication

- API keys with HMAC-SHA256 validation
- Keys stored as hashes, not plaintext
- 90-day key rotation policy

## Tenant Isolation

- Row Level Security (RLS) on all tables
- Tenant context set per request
- API key determines tenant, not headers

## Rate Limiting

- Per-tenant limits configurable
- Burst allowance for legitimate spikes
- IP-based fallback for unauthenticated requests

## Data Protection

- Encryption at rest for sensitive fields
- TLS for all connections
- Audit logging for all access

## Known Vulnerabilities

1. **Spoofable Tenant ID**: Header-based tenant resolution allows cross-tenant access
2. **Global Rate Limit**: One tenant can exhaust resources for all

## Hardening

- Validate API key belongs to claimed tenant
- Rate limit per API key and per tenant
- Rate limit per IP as additional layer
- Input sanitization on all parameters
