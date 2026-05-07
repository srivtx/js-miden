# Three Wrong Ways to Handle JWTs

All three look reasonable. All three are wrong.

---

## Wrong Way #1: Client-Side Expiry Check

```javascript
// Client stores token + expiry
const token = localStorage.getItem('token');
const expiry = localStorage.getItem('tokenExpiry');

if (Date.now() > expiry) {
  // Token expired, redirect to login
}
```

**Why it looks right:** The client knows when the token expires. It should handle it gracefully.

**Why it's wrong:** 
- The client is **untrusted**. An attacker can modify `localStorage`.
- Even if the client "thinks" the token expired, the server still accepts it.
- This gives a false sense of security. "We check expiry!" No, you don't. The server doesn't.

**The real fix:** Server validates `exp` on every request. Client-side checks are UX, not security.

---

## Wrong Way #2: Secret in Code

```javascript
const SECRET = 'my-app-secret-2024';

function signToken(userId) {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: '1h' });
}
```

**Why it looks right:** It's simple. The secret is "secret" because it's not in the docs.

**Why it's wrong:**
- Hardcoded secrets are in git history forever
- Every developer has the secret on their laptop
- If the repo is ever public (accidentally or via breach), the secret is exposed
- Rotating the secret requires a code deploy

**The real fix:** Load secret from environment variable, KMS, or secret manager. Rotate regularly.

---

## Wrong Way #3: Algorithm Confusion Ignored

```javascript
jwt.verify(token, secret); // No algorithm specified!
```

**Why it looks right:** The library figures out the algorithm from the token header. Convenient!

**Why it's wrong:**
- An attacker changes the `alg` header from `HS256` to `none`
- Some (old) JWT libraries accept `alg: none` and skip verification
- An attacker can also change `alg` from `RS256` (asymmetric) to `HS256` (symmetric) and sign with the **public key** as the HMAC secret

**The real fix:** Explicitly specify allowed algorithms:
```javascript
jwt.verify(token, secret, { algorithms: ['HS256'] });
```

---

## The Pattern

All three wrong ways share a theme: **trust without verification.**

- Trust the client to check expiry
- Trust that "secret in code" stays secret
- Trust the token's algorithm header

JWT security is about **verifying everything, trusting nothing.**
