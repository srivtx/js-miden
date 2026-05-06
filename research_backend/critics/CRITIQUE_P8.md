# Critique Report: Project 8 — Multi-tenant API Gateway

**Reviewer:** Senior Technical Critic  
**Date:** 2026-05-06  
**Verdict:** Strong architecture and compliance coverage, but undermined by a SQL injection vulnerability, completely ineffective RLS due to missing role setup, and a timing-attack-vulnerable API key lookup. The gap between "what is taught" and "what actually works" is the largest of any project in this series.

---

## Severity Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 9 | 🔴 Must Fix |
| MAJOR | 12 | 🟠 Should Fix |
| MINOR | 9 | 🟡 Polish |
| MISSING | 9 | ⚪ Add |

---

## CRITICAL (Will Cause Incidents If Copied)

### C1. SQL Injection in `withTenant`
**Location:** `src/db/index.ts`, `withTenant()` function  
**Issue:**
```typescript
await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);
```
This is **raw string interpolation into SQL**. While `tenantId` is typically a UUID (limited character set), this sets an atrocious example. If any code path passes a user-controlled string, it is trivially injectable. Worse, this is the *security-critical* RLS setup function.  
**Fix:** `await client.query('SET LOCAL app.current_tenant = $1', [tenantId]);`

### C2. RLS Policies Are Completely Ineffective
**Location:** `src/db/migrations/001_initial.sql`  
**Issue:** The migration creates policies `TO app_user`, but there is **no `CREATE ROLE app_user`**, no `GRANT`, and no connection configuration to use this role. PostgreSQL RLS is **bypassed by default for the table owner**. The Node.js app likely connects as the `postgres` superuser or the owner created by Docker. This means **RLS does nothing.** The entire security model of the project is a fiction.  
**Fix:** Add to migration:
```sql
CREATE ROLE app_user LOGIN PASSWORD '...';
GRANT SELECT, INSERT, UPDATE, DELETE ON users, api_keys, api_logs TO app_user;
ALTER TABLE users FORCE ROW LEVEL SECURITY; -- bypass table owner too
```
And update the connection string to use `app_user`.

### C3. API Key Lookup Vulnerable to Timing Attack
**Location:** `src/gateway/auth.ts`, `authenticateApiKey()`  
**Issue:** The code hashes the incoming key and does `SELECT ... WHERE key_hash = $1`. If no rows are found, it returns 401 immediately. An attacker can measure the response time difference between "hash not found" (fast) and "hash found but wrong tenant" (slow, because it does the tenant check). Even worse, SHA256 is fast — an attacker can brute-force predictable key prefixes offline.  
**Fix:** Use bcrypt/Argon2 for key hashing, or at minimum use `crypto.timingSafeEqual` after selecting ALL keys and comparing in constant time. Better yet: use HMAC(key, secret) for lookup.

### C4. `withTenant` Casts `PoolClient` to `Pool`
**Location:** `src/db/index.ts`  
**Issue:** `callback(client as unknown as Pool)` passes a `PoolClient` masquerading as a `Pool`. The callback signature promises a `Pool`, but it's actually a single connection with RLS set. If the callback calls `db.connect()` (thinking it has a Pool), it gets a *new* connection without the tenant set, bypassing RLS entirely. This is a type-safety and security trap.  
**Fix:** Change the callback signature to accept `PoolClient`, or use a proper wrapper that enforces the connection scope.

### C5. No Input Validation on Tenant Provisioning
**Location:** `src/handlers/tenants.ts`  
**Issue:** `req.body.subdomain`, `req.body.name`, `req.body.plan` are used without validation beyond a regex. `name` can be 50KB of garbage. `plan` can be any string, bypassing the intended enum.  
**Fix:** Use Zod: `z.object({ subdomain: z.string().max(63).regex(/^[a-z0-9-]+$/), name: z.string().max(255), plan: z.enum(['free', 'pro', 'enterprise']) })`.

### C6. Rate Limiter Uses Simple Counter, Not Token Bucket
**Location:** `src/gateway/rate-limit.ts`  
**Issue:** The implementation does `redis.incr(key)` + `redis.expire(key, window, 'NX')`. This is a **fixed-window counter**, not the token bucket described in Section 3.7. At window boundaries, a burst of `2 × limit` requests can slip through (the "thundering herd at midnight" problem). The sophisticated Lua script in Section 3.7 is never used in the actual build guide.  
**Fix:** Replace the simple counter with the token bucket Lua script, or clearly label this as "sliding window counter (simplified)" and explain the trade-off.

### C7. OpenTelemetry Span Never Ends on Error
**Location:** `src/telemetry/middleware.ts`  
**Issue:** The `traceMiddleware` starts a span, then calls `next()`. If `next()` throws (uncaught exception in handler), the `res.on('finish')` event never fires, and `span.end()` is never called. This leaks memory in the tracer and produces incomplete traces.  
**Fix:** Wrap in `try/finally` or use `res.on('close', ...)` in addition to `'finish'`.

### C8. `resolveTenant` Returns 404 for Missing Tenant But Still Calls `next()`
**Location:** `src/gateway/tenant.ts`  
**Issue:** Actually, looking closely: if `cached` is null, it does `res.status(404).json(...)` and does NOT call `next()`. That's fine. But if `cached` exists, `req.tenant = JSON.parse(cached)` can throw if Redis was corrupted. No try/catch.  
**Fix:** Wrap `JSON.parse` in try/catch and return 500 for corrupted cache.

### C9. GDPR Deletion Endpoint Uses `(req as any).scopes`
**Location:** `src/handlers/gdpr.ts`  
**Issue:** The deletion endpoint checks `const scopes = (req as any).scopes || []`. The `authenticateApiKey` middleware sets `(req as any).scopes = keyRecord.scopes`. There is no type definition for `req.scopes`, and the `as any` cast bypasses all type safety. If the middleware is reordered or removed, this becomes `undefined` and the check passes silently.  
**Fix:** Add `scopes: string[]` to the Express `Request` interface declaration and use strict typing.

---

## MAJOR (Outdated, Inefficient, or Brittle)

### M1. Missing `app_user` Role and Permission Grants
**Location:** Migration file  
**Issue:** Even if C2 is fixed, there are no `GRANT` statements for any table. The `app_user` role cannot read or write any data. The migration also doesn't create the role.  
**Fix:** Complete the RLS setup with role creation, grants, and `FORCE ROW LEVEL SECURITY`.

### M2. No Index on `api_keys.key_hash`
**Location:** Migration file  
**Issue:** Every API request does `SELECT ... FROM api_keys WHERE key_hash = $1`. Without an index on `key_hash`, this is a sequential scan on every single request. At 10k RPS, this melts PostgreSQL.  
**Fix:** `CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);`

### M3. `last_used_at` Updated Synchronously on Every Request
**Location:** `src/gateway/auth.ts`  
**Issue:** `UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1` is a synchronous write on the critical path of *every* API request. This creates row-level lock contention on the `api_keys` table and adds ~5-10ms latency to every call.  
**Fix:** Write `last_used_at` asynchronously (e.g., to Redis, then flush to DB every minute) or remove it from the auth path.

### M4. No API Key Expiration or Revocation
**Location:** `api_keys` table  
**Issue:** The schema has no `expires_at`, `revoked_at`, or `revoked` column. Keys are valid forever. A leaked key cannot be rotated without deleting the row entirely, and there's no audit trail of *when* a key was revoked.  
**Fix:** Add `expires_at TIMESTAMPTZ` and `revoked_at TIMESTAMPTZ`, and check them in `authenticateApiKey`.

### M5. Feature Flag Middleware Doesn't Import Express Types
**Location:** `src/features/flags.ts`  
**Issue:** `requireFeature` uses `req: Request` but doesn't import it from 'express'. The snippet is incomplete and will fail TypeScript compilation.  
**Fix:** Add `import { Request, Response, NextFunction } from 'express';`

### M6. `traceMiddleware` Placed After Auth and Rate Limit
**Location:** `src/index.ts`  
**Issue:** The middleware order is: `resolveTenant` → `authenticateApiKey` → `rateLimit` → `traceMiddleware`. This means requests that fail auth or rate limiting are never traced. Debugging "why is Tenant X getting 429s" is impossible because the span was never started.  
**Fix:** Move `traceMiddleware` to the top, immediately after `resolveTenant`.

### M7. Tenant Provisioning Has No Rate Limit
**Location:** `src/handlers/tenants.ts`  
**Issue:** Anyone can `POST /tenants` infinitely, creating tenants, Redis keys, and database rows. This is a resource exhaustion attack vector.  
**Fix:** Add strict rate limiting (e.g., 5 requests per hour per IP) and CAPTCHA for provisioning.

### M8. `deleteTenantCompletely` Doesn't Clean Up Redis Rate Limit / Feature Keys
**Location:** `src/handlers/gdpr.ts`  
**Issue:** The deletion removes tenant metadata and subdomain cache, but leaves `ratelimit:${tenantId}:api` and `feature:${feature}:tenant:${tenantId}` keys in Redis. Over time, Redis memory fills with orphaned keys.  
**Fix:** Scan and delete `ratelimit:${tenantId}:*` and `feature:*:tenant:${tenantId}` during deletion.

### M9. No Schema Validation on `req.body` Anywhere
**Location:** All handlers  
**Issue:** None of the endpoints use Zod, Joi, or express-validator. `req.body` is passed directly to SQL queries. While parameterized queries prevent SQL injection, invalid data types cause 500 errors and potential information leakage via stack traces.  
**Fix:** Add Zod validation to every handler.

### M10. `billing_monthly` Retains Data with `ON DELETE SET NULL`
**Location:** Migration  
**Issue:** The FK from `billing_monthly` to `tenants` uses `ON DELETE SET NULL`. For GDPR, aggregated billing data with `tenant_id = NULL` and `tenant_name = '[deleted]'` might still be considered personal data if it can be re-identified. The project should discuss this ambiguity.  
**Fix:** Add a note that legal counsel should review retention of anonymized aggregated data.

### M11. Nginx Config Missing Security Headers
**Location:** `nginx.conf`  
**Issue:** No `X-Frame-Options`, `X-Content-Type-Options`, or rate limiting at the edge. A tenant could DDoS the gateway before the app-layer rate limiter kicks in.  
**Fix:** Add `limit_req_zone` and basic security headers.

### M12. `pool.query(sql)` in Migration Runner Is Unsafe
**Location:** `src/db/migrate.ts`  
**Issue:** The migration reads an entire SQL file and runs `pool.query(sql)`. If the SQL file contains multiple statements separated by semicolons, `pg` driver's `pool.query()` may not handle them correctly depending on the client library version.  
**Fix:** Use a migration library like `node-pg-migrate` or split statements and run them sequentially.

---

## MINOR (Typos, Inconsistencies, Edge Cases)

1. **Inconsistent `Request` imports:** Some files import `Request` from 'express', others don't import it at all (e.g., `features/flags.ts`).
2. **`(req as any).tenant.id` in feature flags:** Should use the properly typed `req.tenant.id` from the global declaration.
3. **`@opentelemetry/semantic-conventions` import mismatch:** Section 4.10 uses `ATTR_SERVICE_NAME` (v2 convention), but the setup in Section 3.8 uses `SemanticResourceAttributes.SERVICE_NAME` (v1 convention). Inconsistent.
4. **Typo in `deleteTenantCompletely`:** The function tries to get subdomain from Redis after deleting the tenant mapping: `const subdomain = await redis.get(`tenant:id:${tenantId}:subdomain`);` — but this key was not set in the provisioning endpoint (only `tenant:subdomain:${subdomain}` and `tenant:id:${tenant.id}:subdomain` are set). Wait, actually `tenant:id:${tenant.id}:subdomain` IS set. The getter uses `tenantId` not `tenant.id` but they should match. This is actually fine, though confusing naming.
5. **No `return` after `res.status(409)` in tenant provisioning:** Actually there is `return`.
6. **`pnpm add express@5`** — Express 5 was released recently but is still less battle-tested than Express 4. For educational material, this is acceptable but risky.
7. **Docker Compose `app` service runs migrations on start:** `command: ["sh", "-c", "pnpm db:migrate && pnpm start"]`. If multiple containers start simultaneously, they race to run migrations. In production, migrations should be a separate job, not the app startup command.
8. **Missing `EXPOSE` instruction consistency:** The Dockerfile exposes 3000, but the nginx config proxies to `app:3000`. This is fine.
9. **`initTelemetry()` is called before any error handlers:** If telemetry setup fails, the app crashes with no useful output.

---

## MISSING (What Should Be Covered)

1. **API key rotation flow:** How does a tenant rotate a compromised key without downtime? Not discussed.
2. **Webhook signature verification:** If tenants receive webhooks, how are they signed and verified?
3. **CORS per tenant:** Different tenants may have different allowed origins. No CORS middleware is shown.
4. **Zero-downtime migrations:** For a multi-tenant shared schema, migrations must be backward-compatible. No discussion of expand/contract or blue/green deploys.
5. **Connection pool exhaustion per tenant:** One tenant with a traffic spike could exhaust the global connection pool. No per-tenant pool limiting.
6. **Request/response size limits:** A tenant could upload a 1GB JSON payload and crash the server. No `express.json({ limit })` configuration.
7. **SQL injection prevention within a tenant:** RLS isolates tenants, but a tenant can still SQL-inject themselves if the app concatenates user input. Parameterized queries are used, but this isn't explicitly called out as a defense.
8. **Backup encryption and key rotation:** GDPR requires secure backups. No discussion of encrypted backups or key management.
9. **Tenant impersonation / support login:** How do platform admins debug a tenant's issue without knowing their API key? No support access pattern.

---

## EDUCATIONAL QUALITY

### What Works
- **The RLS conceptual explanation** is excellent. The `withTenant` pattern, `SET LOCAL`, and policy syntax are clearly explained.
- **Bug 2 (Tenant Resolution by Header)** is a genuinely dangerous and realistic vulnerability. The fix correctly emphasizes that the API key is the only trusted anchor.
- **Bug 4 (GDPR Incomplete Deletion)** and the deletion flow diagram are comprehensive and legally aware. This is rare in backend tutorials.
- **The multi-tenant rate limiting Lua script** is advanced, correct, and a great teaching tool for Redis scripting.
- **The SOC 2 mapping table** is a nice touch that connects code to compliance frameworks.

### What Fails
- **The RLS implementation is security theater.** The project spends pages explaining RLS but never creates the `app_user` role or connects as it. Students will follow the migration, deploy the app, and think they're protected when they're not. This is the most dangerous kind of educational failure: a false sense of security.
- **`withTenant` contains SQL injection.** Teaching students to interpolate variables into SQL, even in a "safe" context, is negligent.
- **The token bucket Lua script is taught but never used.** The actual rate limiter in the build guide is a naive fixed-window counter. Students will build the broken one thinking they learned the sophisticated one.
- **The `withTenant` type cast (`PoolClient` as `Pool`)** is a TypeScript anti-pattern that undermines the entire type system.

### Recommendation
**This project must not be released to students until:**
1. The migration creates `app_user`, grants permissions, and uses `FORCE ROW LEVEL SECURITY`.
2. The `withTenant` function uses parameterized queries for `SET LOCAL`.
3. The callback signature accepts `PoolClient`, not `Pool`.
4. The build-guide rate limiter matches the taught token bucket algorithm, or the difference is explicitly explained.
5. API key hashing uses bcrypt/Argon2 or HMAC, with an index on `key_hash`.
6. All handlers get Zod validation.
7. `traceMiddleware` is moved before auth/rate-limit in the middleware stack.

---

*End of Critique P8*
