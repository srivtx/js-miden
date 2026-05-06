# M07: JWT Auth — Senior Engineer Review

## What We Did Well

### 1. Defense in Depth

We didn't rely on a single security control. The architecture layers:
- Short-lived access tokens (time boundary)
- Refresh token rotation (theft detection)
- httpOnly cookies (XSS protection)
- SameSite=Strict (CSRF protection)
- Algorithm allow-list (confusion prevention)
- jti blocklist (revocation capability)

Removing any one layer does not collapse the entire system.

### 2. Explicit Algorithm Selection

```typescript
jwt.verify(token, secret, { algorithms: ['HS256'] });
```

This single line prevents the infamous `alg: none` and algorithm confusion attacks. It should be the first thing a code reviewer checks.

### 3. Single-Use Refresh Tokens

By marking refresh tokens as used and invalidating the family on reuse, we turn a token theft from a silent compromise into a **detectable event**. The legitimate user will notice they were logged out.

---

## What We Compromised On

### 1. Revocation Is Not Instant

Access tokens are stateless and short-lived. If a user logs out, their access token remains valid until expiry (up to 15 minutes). The jti blocklist helps, but there's a propagation delay if using Redis.

**Alternative:** Issue even shorter access tokens (5 minutes) at the cost of more refresh requests.

### 2. Symmetric Key (HS256) In a Distributed System

If this auth service is the only issuer and verifier, HS256 is fine. But if other microservices need to verify tokens, they all need the secret. A leak in any service compromises the entire trust boundary.

**Recommendation:** Migrate to RS256 or EdDSA if the system grows beyond one verifier.

### 3. No Device Binding

We hash and store refresh tokens, but we don't bind them to a device fingerprint or IP address. A stolen refresh token can be used from anywhere in the world.

**Recommendation:** Add a relaxed device fingerprint (e.g., browser + OS hash, not IP, to avoid false positives on mobile networks).

---

## Critique of the "Stateless = Scalable" Myth

JWT marketing often claims "stateless auth scales better." This is partially true but misleading:

- **Token verification** is stateless and fast (microsecond scale)
- **Token revocation** is stateful and requires a blocklist store
- **Refresh token validation** is fully stateful (database lookup)

You have not eliminated state; you have moved it from "every request" to "specific operations." The architecture is still simpler than session replication, but don't pretend there's no database involved.

---

## Security vs UX Trade-offs

| Security Measure | UX Cost |
|-----------------|---------|
| 15-minute access tokens | Frequent silent refresh requests |
| SameSite=Strict | OAuth redirects and deep links may break |
| Refresh token rotation | Parallel requests may race and log the user out |
| Device binding | Legitimate users on VPN/mobile may be blocked |

There is no perfect balance. Document your threat model and justify each choice.

---

## Code Review Red Flags

A senior engineer should reject any PR containing:

```typescript
// ❌ RED FLAG
jwt.verify(token, secret, { ignoreExpiration: true });

// ❌ RED FLAG
jwt.verify(token, secret); // no algorithms specified

// ❌ RED FLAG
const payload = jwt.decode(token); // decode without verify

// ❌ RED FLAG
localStorage.setItem('token', token);

// ❌ RED FLAG
res.cookie('token', token); // no httpOnly, no Secure, no SameSite
```

---

## Final Verdict

This implementation is **production-ready for a monolithic SPA/API** with the following caveats:

1. Monitor the jti blocklist size (should be small due to short TTL)
2. Plan RS256 migration if adding microservice verifiers
3. Add rate limiting on `/auth/login` and `/auth/refresh`
4. Implement account lockout after N failed login attempts
5. Conduct a pen test focusing on XSS vectors (the remaining attack surface for cookie theft)

JWT is a sharp tool. This implementation wraps it in enough safety guards to be deployable, but the team must remain vigilant against configuration drift.
