# M07: JWT Auth — Architecture Decisions

## Decision 1: JWT vs Sessions vs API Keys

### Sessions (Server-Side)

| Pros | Cons |
|------|------|
| Easy revocation (delete from DB) | Requires session store lookup per request |
| Small cookie payload (just session ID) | Horizontal scaling requires shared store (Redis) |
| Well-understood security model | CSRF protection needed |

**Best for:** Traditional server-rendered apps, monolithic architectures.

### JWT (Client-Side State)

| Pros | Cons |
|------|------|
| Stateless verification (no DB hit) | Cannot easily revoke without blocklist |
| Natural fit for microservices (shared public key) | Larger payload than session cookie |
| Cross-domain friendly | Payload readable by client (no confidentiality) |

**Best for:** Microservices, SPAs, mobile APIs, cross-domain architectures.

### API Keys

| Pros | Cons |
|------|------|
| Simple for machine-to-machine | No standard format, often plaintext in DB |
| Long-lived by design | Hard to scope/expire granularly |

**Best for:** Third-party integrations, service accounts.

**Decision:** Use JWT for user authentication in an SPA/API architecture. Use API keys for service-to-service. Use sessions for server-rendered apps.

---

## Decision 2: HS256 vs RS256

### HS256 (HMAC + SHA-256)

```
signature = HMAC-SHA256(base64url(header) + "." + base64url(payload), secret)
```

- Symmetric: same key signs and verifies
- Fast (~1μs per operation)
- Key must be shared among all verifiers

**Risk:** If any service leaks the secret, the attacker can forge tokens.

### RS256 (RSA + SHA-256)

```
signature = RSA-SHA256(base64url(header) + "." + base64url(payload), privateKey)
verification = RSA-SHA256-verify(signature, publicKey)
```

- Asymmetric: private key signs, public key verifies
- Slower (~100μs per operation)
- Public key can be distributed safely

**Benefit:** Microservices can verify tokens without possessing the signing key.

**Decision:** Use RS256 for distributed systems with multiple verifiers. Use HS256 for simple monolithic apps where only one service issues and verifies.

---

## Decision 3: localStorage vs Cookies

### localStorage / sessionStorage

```javascript
localStorage.setItem('access_token', token);
```

- Accessible to all JavaScript on the domain
- Sent automatically to any API call (you must manually attach header)
- Survives browser restart (localStorage)

### httpOnly Cookie

```http
Set-Cookie: access_token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=900
```

- **Inaccessible** to JavaScript (XSS cannot steal it)
- Automatically sent by browser on same-origin requests
- Requires CSRF protection if using `SameSite=None` for cross-origin

### Comparison Matrix

| Threat | localStorage | httpOnly Cookie |
|--------|--------------|-----------------|
| XSS theft | ❌ Vulnerable | ✅ Protected |
| CSRF | ✅ Not auto-sent | ⚠️ Needs `SameSite` |
| Token size limits | ✅ Large | ❌ ~4KB |
| Cross-domain APIs | ✅ Easy | ⚠️ Complex |
| SSR compatibility | ⚠️ Manual | ✅ Automatic |

**Decision:** Default to httpOnly cookies for same-origin SPAs. Use localStorage only for cross-domain architectures where cookies are impractical, and pair with strict CSP + short token lifetimes.

---

## Decision 4: Refresh Token Storage

Refresh tokens are long-lived and high-value. Store them:

- In an **httpOnly cookie** (not accessible to JS)
- With **tight path scoping** (`Path=/api/auth/refresh`)
- With **binding to device/session** (store a hash in DB, compare on refresh)
- As **single-use tokens** (rotate on every refresh, invalidate family on theft detection)

This pattern is called **Refresh Token Rotation** (OWASP recommendation).
