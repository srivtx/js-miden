# 04-OLD-VS-NEW

## 2015 Patterns
- Single shared `users` table with a `tenant_id` column.
- JWT with only `userId`; no tenant claim.
- Cookie sessions stored in memory or filesystem.
- Role checks hardcoded in route handlers.
- No subdomain separation; all tenants on the same domain.

## 2025 Patterns
- Schema-per-tenant or database-per-tenant with strong isolation.
- JWT with `tenantId`, `roles`, and `audience` claims; validated on every request.
- OIDC / OAuth2 with identity providers (Auth0, Clerk, Keycloak).
- Row-Level Security (RLS) in PostgreSQL as a safety net.
- Subdomain or custom domain resolution with wildcard TLS.
- Zero-trust: every service validates tokens independently.
