# 00-PROBLEM

## WHAT
Build a multi-tenant authentication system for a SaaS product. Tenants are isolated via subdomain or header. JWTs carry a tenant claim. Role-based access is enforced per tenant. Database schemas are tenant-specific.

## WHY
In SaaS, a single user may belong to multiple tenants with different roles. A compromised or misconfigured auth layer can leak data across tenants, which is a catastrophic business risk.

## Constraints
- Tenant resolution must happen before authentication.
- JWT must contain a tenant claim signed by the server.
- Each tenant should have its own PostgreSQL schema for strong isolation.
- Role checks must be tenant-scoped.
