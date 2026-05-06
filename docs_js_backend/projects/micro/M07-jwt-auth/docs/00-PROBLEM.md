# M07: JWT Auth — Problem, Constraints, Scope

## The Problem

Build a stateless authentication system for a Node.js/Express API that can:

1. **Issue** signed tokens after validating user credentials
2. **Verify** tokens on every protected route
3. **Protect** against token tampering, replay, and expiration bypass
4. **Support** token refresh without compromising security

The core challenge: proving identity across HTTP requests without storing session state on the server.

---

## Why JWT Exists

HTTP is stateless. Every request from a client is independent. Traditional session cookies solve this by storing a session ID server-side, but this has costs:

- Database/session store lookup on every request
- Sticky sessions or shared session stores in distributed systems
- Memory pressure on servers at scale

JWT moves the session state to the client (the token itself) while keeping it tamper-proof via cryptographic signature.

---

## Constraints

### Functional Constraints

| Constraint | Requirement |
|-----------|-------------|
| Stateless | Server must not query a database/session store to validate a token |
| Compact | Token must fit in an HTTP header (typical JWT: ~300–500 bytes) |
| Self-contained | Token must carry all claims needed for authorization |
| Expirable | Tokens must have a bounded lifetime |
| Revocable | There must be a mechanism to invalidate tokens before expiry |

### Non-Functional Constraints

| Constraint | Target |
|-----------|--------|
| Latency | Verification must complete in < 1ms |
| Algorithm agility | Must support algorithm migration without breaking existing tokens |
| Key rotation | Must be possible to rotate signing keys |
| Transport security | Must only transmit over HTTPS |

### Scope

**In scope:**
- JWT generation and verification
- Token payload design (claims selection)
- Refresh token rotation
- Secure transport and storage recommendations

**Out of scope:**
- OAuth 2.0 / OpenID Connect flows
- Multi-factor authentication
- Identity provider integration
- Fine-grained authorization (RBAC/ABAC implementation)

---

## The Threat Model

An attacker may attempt to:

1. **Forge a token** by signing with a stolen key or algorithm confusion
2. **Tamper with payload** and bypass signature verification
3. **Replay a stolen token** after logout
4. **Steal tokens from client storage** (XSS on localStorage)
5. **Exfiltrate tokens via CSRF** if stored in cookies without protections
6. **Extend token lifetime** by exploiting `ignoreExpiration: true`

Every design decision must address one or more of these threats.

---

## Success Criteria

- [ ] Access tokens expire in ≤ 15 minutes
- [ ] Refresh tokens expire in ≤ 7 days and are single-use
- [ ] Tokens use a secure signing algorithm (HS256 or RS256, never "none")
- [ ] Tokens are transmitted via `Authorization: Bearer` header or httpOnly cookie
- [ ] Token verification rejects expired, malformed, and tampered tokens
- [ ] A token revocation list (or blocklist) exists for logout scenarios
