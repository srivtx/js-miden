# M08: Password Hasher — Senior Engineer Review

## What We Did Well

### 1. Algorithm Selection

Choosing Argon2id (with bcrypt fallback) aligns with OWASP 2023 recommendations. We did not compromise on "what's easiest to install" or "what's fastest."

### 2. Parameter Transparency

The hash string embeds all parameters:
```
$argon2id$v=19$m=65536,t=3,p=4$...
```

This means:
- No schema migrations when upgrading parameters
- Any developer can read the hash and understand its strength
- Third-party security auditors can verify compliance without database access

### 3. Transparent Upgrade Path

The `verifyAndRehashIfNeeded` pattern is the gold standard for hash migration:
- Users are not forced to reset passwords
- Security improves on every login
- Old weak hashes are phased out naturally

### 4. Defense Against Timing Attacks

Using `argon2.verify()` instead of manual comparison eliminates an entire class of side-channel vulnerabilities. The `timingSafeEqual` fallback is documented for edge cases.

---

## What We Compromised On

### 1. No Pepper Implementation by Default

We documented pepper but did not require it. For high-security applications (finance, healthcare), a pepper stored in an HSM adds significant defense-in-depth.

**Mitigation:** Add a `PEPPER_REQUIRED` environment flag for high-security deployments.

### 2. No Rate Limiting

The hashing module itself does not prevent attackers from calling `verifyPassword` millions of times. Rate limiting must be implemented at the API layer.

**Mitigation:** Document that the auth endpoint must have:
- Per-IP rate limiting (5 attempts per minute)
- Per-account rate limiting (10 attempts per hour)
- Progressive delays (exponential backoff)

### 3. No Breach Detection Integration

We hash passwords but don't check if they appeared in known breaches during registration. A user signing up with `password123` will get a strong hash of a terrible password.

**Mitigation:** Integrate Have I Been Pwned API in the registration flow. Reject passwords that appear in breach databases.

---

## Critique of "Hash Time" Benchmarks

Developers often benchmark hashing on their laptop and declare victory. This is misleading:

- **Development laptops** are often faster per-core than production VMs
- **Shared hosting / containers** have noisy neighbors affecting CPU time
- **Bursty login traffic** (e.g., after a marketing email) can overload the server if each hash takes 1 second

**Recommendation:**
1. Benchmark on production-equivalent hardware
2. Set a target that leaves 50% CPU headroom during peak traffic
3. Monitor average and p99 hash latency in production
4. Adjust parameters annually, not once

---

## The "Moore's Law" Trap

A common mistake:

> "We set bcrypt cost to 12 in 2020. It's 2024 now, so we should increase to 14."

This is correct in principle but dangerous in practice if not accompanied by load testing. Doubling the cost doubles the CPU time per login. If you have 10,000 concurrent logins, the difference between 250ms and 500ms is the difference between 40 and 20 logins/second per core.

**Recommendation:** Upgrade parameters gradually. Increase by 1 cost level, monitor for 2 weeks, then reassess.

---

## Security vs UX Trade-offs

| Security Measure | UX Cost |
|-----------------|---------|
| Argon2id (500ms) | Slower login, especially on mobile |
| Password breach check | Slightly slower registration |
| Account lockout after 5 failures | Frustrated users, support tickets |
| Mandatory 16-character passwords | Abandonment at registration |

NIST 800-63B's controversial but correct advice: **Do not require complexity.** A 16-character passphrase (`correct-horse-battery-staple`) is stronger and more memorable than `P@ssw0rd1`.

---

## Code Review Red Flags

A senior engineer should reject any PR containing:

```typescript
// ❌ RED FLAG
const hash = createHash('sha256').update(password).digest('hex');

// ❌ RED FLAG
const hash = createHash('md5').update(password).digest('hex');

// ❌ RED FLAG
return inputHash === storedHash;

// ❌ RED FLAG
bcrypt.hash(password, 4);  // Too fast

// ❌ RED FLAG
// No salt parameter (in algorithms that require manual salt)
```

---

## Final Verdict

This implementation is **production-ready** for general web applications with the following actions:

1. **Immediate:** Add rate limiting on login endpoints (not the hasher's job, but critical)
2. **Short-term:** Integrate Have I Been Pwned API in registration
3. **Medium-term:** Add optional pepper support for high-security tenants
4. **Ongoing:** Benchmark and upgrade Argon2id parameters annually
5. **Security audit:** Test for timing side channels using `timing_check` tools

Password hashing is not exciting engineering, but it is the wall that separates "we had a database leak" from "every user's account on every site is compromised." This implementation builds a strong wall.
