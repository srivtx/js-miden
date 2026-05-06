# 06-BUGS

## Intentional Bug: JWT Tenant Claim Not Validated

### Description
The authentication middleware verifies the JWT signature and expiry, but the `requireTenant` middleware does not check whether the `tenantId` inside the JWT matches the tenant resolved from the request (header or subdomain).

### Location
`src/middleware.ts`:
```typescript
export function requireTenant(req, res, next) {
  const requestTenant = req.headers['x-tenant-id'] || req.subdomains[0];
  (req as any).requestTenant = requestTenant;
  next(); // BUG: no validation against decoded.tenantId
}
```

### Real-World Impact
- Cross-tenant data access: a user with ID `1` in Tenant A can access resources of User ID `1` in Tenant B.
- Complete SaaS isolation collapse.
- Legal and contractual breach; customers may sue for data exposure.
- If the user is an admin in Tenant A, they may become an admin in Tenant B depending on role lookups.

### Fix
```typescript
export function requireTenant(req, res, next) {
  const requestTenant = req.headers['x-tenant-id'] || req.subdomains[0];
  if ((req as any).tenantId !== requestTenant) {
    return res.status(403).json({ error: 'Tenant mismatch' });
  }
  next();
}
```
