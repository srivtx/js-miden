# 03-CONCEPTS

## Tenant Isolation
- **WHAT**: Ensuring one tenant's data and users are invisible to others.
- **WHY**: A SaaS breach across tenants is a company-ending event.
- **HOW**: Separate DB schemas, RLS policies, or entirely separate databases.
- **WRONG**: `SELECT * FROM users WHERE id = $1` without a tenant filter.
- **RIGHT**: `SELECT * FROM tenant_a.users WHERE id = $1`.

## JWT Claims
- **WHAT**: Signed payload containing user and tenant metadata.
- **WHY**: Stateless auth scales better than sessions.
- **HOW**: Sign `{ userId, tenantId, roles }` with a secret; validate signature AND claims on every request.
- **WRONG**: Validating signature only, ignoring whether the tenant claim matches the request.
- **RIGHT**: `if (decoded.tenantId !== resolvedTenant) throw Unauthorized`.

## Role-Based Access Control (RBAC)
- **WHAT**: Permissions tied to roles, not individual users.
- **WHY**: Simplifies management when users change roles or leave.
- **HOW**: `tenant_a.user_roles` table mapping users to roles; middleware checks role before route handler.
- **WRONG**: Hardcoding `if (user.email === 'admin@company.com')`.
- **RIGHT**: `if (user.roles.includes('admin'))`.
