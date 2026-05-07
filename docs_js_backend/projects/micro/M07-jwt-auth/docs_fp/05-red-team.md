# Red Team: Breaking JWT Auth

You're the attacker. The target uses JWTs for authentication. Find 3 ways in.

---

## Attack 1: Algorithm Confusion

**Scenario:** The server verifies JWTs with this code:
```javascript
jwt.verify(token, publicKey); // RS256 usually
```

**The vulnerability:** The server doesn't specify which algorithms are allowed.

**Your attack:**
1. Get the server's public key (it might be exposed at `/.well-known/jwks.json`)
2. Create a token with header: `{"alg": "HS256"}`
3. Sign it with the **public key as the HMAC secret**
4. The server verifies HMAC using the public key — and it matches!

**Impact:** You can forge tokens for any user.

**Defense:** Always specify allowed algorithms:
```javascript
jwt.verify(token, key, { algorithms: ['RS256'] });
```

---

## Attack 2: Expiry Bypass via Clock Skew

**Scenario:** The server checks expiry but allows clock skew:
```javascript
jwt.verify(token, secret, { clockTolerance: 300 }); // 5 minutes
```

**The vulnerability:** A stolen token is valid for 5 minutes past expiry. If the attacker can replay within that window, expiry doesn't protect you.

**Your attack:**
1. Steal a token (XSS, network sniffing, etc.)
2. Use it immediately — within the clock tolerance window
3. Even after "expiry," the server accepts it

**Impact:** Token replay attacks succeed even for "expired" tokens.

**Defense:** Use short expiry (5-15 minutes) + refresh tokens. Don't rely on clock tolerance for security.

---

## Attack 3: Key ID Manipulation

**Scenario:** The server uses multiple keys and selects via `kid` header:
```javascript
const key = keys[token.header.kid];
jwt.verify(token, key);
```

**The vulnerability:** If `kid` doesn't match any key, what happens?

**Your attack:**
1. Find an old, revoked key ID
2. Create a token with `kid` pointing to a **known weak key** (or no key)
3. If the server falls back to a default key or skips verification, you're in

**Impact:** You can downgrade to weak keys or bypass verification entirely.

**Defense:** Reject tokens with unknown `kid`. No fallback. No default.

---

## The Principle

> **"JWTs are secure when every claim, every header, and every algorithm is verified. They're insecure when any of those checks are skipped."**
