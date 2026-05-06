# M07: JWT Auth — Latest Trends & Research

## PASETO: A Safer Alternative to JWT

PASETO (Platform-Agnostic Security Tokens) was designed to eliminate JWT's footguns:

| Feature | JWT | PASETO |
|---------|-----|--------|
| Algorithm negotiation | Vulnerable to `alg: none` | No algorithm header; version + purpose define it |
| Encoding complexity | Base64url with padding edge cases | Simpler, purpose-built format |
| Key confusion | Possible (RS256 public key as HS256 secret) | Cryptographically impossible |

PASETO v4 (latest) uses XChaCha20-Poly1305 for local (symmetric) tokens and Ed25519 for public (asymmetric) tokens.

**Status:** Growing adoption in security-conscious systems (e.g., medical, financial). Standard library support still maturing in JavaScript.

---

## BFF Pattern (Backend-for-Frontend)

Modern SPAs increasingly use a **Backend-for-Frontend** layer:

```
SPA ---(HTTP)---> BFF (Node.js) ---(gRPC/mTLS)---> Microservices
                         |
                    httpOnly cookies
```

The BFF handles auth and stores tokens in httpOnly cookies. The SPA never sees a JWT.

**Benefits:**
- No tokens in browser JavaScript
- Can use session-based auth between SPA and BFF
- Microservices still use JWTs internally

---

## OAuth 2.1 & DPoP

OAuth 2.1 (draft) simplifies and tightens OAuth 2.0:
- PKCE required for all clients (prevents authorization code interception)
- Redirect URI exact matching
- No more implicit grant

**DPoP (Demonstrating Proof-of-Possession):**
Binds access tokens to a public key. The client must prove possession of the corresponding private key with every request.

```
Authorization: DPoP eyJ0eXAiOiJkcG9w...  // DPoP-bound token
DPoP: eyJhbGciOiJFUzI1NiIsInR5cCI6ImRwb3Arand0I...  // Proof
```

**Impact:** Even if a token is stolen, it cannot be used without the private key.

---

## WebAuthn / Passkeys

The long-term trend is moving away from shared secrets (passwords + tokens) entirely:

- **WebAuthn:** Public key cryptography for user authentication
- **Passkeys:** Synced, discoverable credentials stored in hardware/software authenticators
- **FIDO2:** Industry standard for passwordless auth

In a passkey architecture:
1. User authenticates with biometrics / PIN
2. Browser signs a challenge with the private key
3. Server verifies with the stored public key
4. A short-lived session cookie is issued

No passwords to hash. No JWTs to steal from localStorage.

---

## OWASP 2023 Recommendations

From the OWASP Cheat Sheet Series — JSON Web Token:

1. **Use strong algorithms:** RS256, ES256, or EdDSA. Avoid HS256 in distributed systems.
2. **Validate all claims:** `exp`, `nbf`, `iss`, `aud`, `sub`
3. **Use short-lived access tokens:** ≤ 15 minutes
4. **Implement refresh token rotation:** Detect reuse and invalidate families
5. **Store tokens securely:** httpOnly, Secure, SameSite cookies
6. **Do not trust the `alg` header:** Hardcode the expected algorithm
7. **Use `jti` for revocation:** Maintain a blocklist with short TTL

---

## Emerging: Zero-Knowledge Proofs (ZKP)

Research is ongoing into using zero-knowledge proofs for authentication:
- Prove you hold a valid credential without revealing the credential itself
- Useful for privacy-preserving identity

**Status:** Academic and early-stage. Not yet practical for general web auth.
