# 08-CRITIQUE

## Senior Engineer Review

### What is done well
- Schema-per-tenant provides strong database isolation.
- JWT includes a tenant claim, which is architecturally correct.
- Password hashing uses bcrypt with salt rounds.

### What is risky
- Raw SQL concatenation for schema names (`tenant_${tenantId}`). If `tenantId` is user-controlled, this becomes SQL injection. Use a whitelist or parameterized schema resolution.
- No refresh token rotation.
- No account lockout or brute-force protection on login beyond the global rate limiter.

### What is missing
- Row-Level Security as a defense-in-depth layer.
- Automated schema migration tooling for new tenants.
- Audit logging of cross-tenant access attempts.

### The Bug
Failing to validate the tenant claim is a catastrophic auth bypass. The JWT is a credential; every claim inside it must be verified against the request context. Never assume that a valid signature means the token is appropriate for this request.
