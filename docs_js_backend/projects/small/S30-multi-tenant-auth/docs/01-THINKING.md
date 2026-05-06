# 01-THINKING

## Mental Model
Multi-tenant auth is a compound gate: tenant gate + identity gate + permission gate. Skipping any gate collapses the wall between tenants.

## Hot Path
1. Request arrives with subdomain or header.
2. Resolve tenant identifier.
3. Authenticate JWT (signature, expiry).
4. Validate that JWT tenant claim matches resolved tenant.
5. Authorize action against tenant-scoped role.
6. Execute query in tenant schema.

## Danger Zones
- **JWT tenant bypass**: If the tenant claim is not validated against the request context, a user from Tenant A can access Tenant B.
- **Schema leakage**: Shared schema without RLS is risky; separate schemas without strict routing are also risky.
- **Role confusion**: A global admin role must not accidentally grant cross-tenant access.
- **Subdomain takeover**: If tenant resolution relies solely on subdomains, expired domains can be hijacked.
