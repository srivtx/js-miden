# Fundamentals: No jsonwebtoken Library

You have only Node.js built-in `crypto` module. No `jsonwebtoken`. No npm.

**Task:** Implement JWT verification from scratch.

A JWT looks like:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

It's three base64url-encoded parts separated by dots:
1. **Header** — `{"alg":"HS256","typ":"JWT"}`
2. **Payload** — `{"sub":"123","name":"John","iat":1516239022}`
3. **Signature** — HMACSHA256(base64url(header) + "." + base64url(payload), secret)

---

## Multiple Choice: Implementing Verification

### Q1: How do you verify the signature?

**A)** Decode the signature with base64, compare to a hash of the payload

**B)** Recompute HMACSHA256(header + "." + payload, secret), compare to signature using `===`

**C)** Recompute HMACSHA256(header + "." + payload, secret), compare to signature using `crypto.timingSafeEqual`

**D)** The signature is just for show; JWT libraries don't actually verify it

**Think before reading on.**

---

### The Answer

**C is correct.** Here's why each is wrong:

- **A:** The signature isn't a hash of the payload alone. It's HMAC of `header.payload`.
- **B:** `===` on strings is vulnerable to **timing attacks**. An attacker can measure how long the comparison takes and guess the signature byte-by-byte.
- **C:** `timingSafeEqual` compares buffers in constant time, preventing timing leaks.
- **D:** JWTs without signature verification are just base64-encoded JSON. Anyone can forge them.

---

## The Code

```javascript
import { createHmac, timingSafeEqual } from 'node:crypto';

function verifyJwt(token, secret) {
  const [headerB64, payloadB64, signatureB64] = token.split('.');
  
  // Recompute signature
  const computed = createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');
  
  // Constant-time comparison
  const expected = Buffer.from(signatureB64, 'base64url');
  const actual = Buffer.from(computed, 'base64url');
  
  if (!timingSafeEqual(expected, actual)) {
    throw new Error('Invalid signature');
  }
  
  // Decode payload
  const payload = JSON.parse(
    Buffer.from(payloadB64, 'base64url').toString()
  );
  
  // Check expiry
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    throw new Error('Token expired');
  }
  
  return payload;
}
```

---

## Why This Matters

The `jsonwebtoken` library does exactly this — but with more edge cases (different algorithms, clock tolerance, audience validation). Understanding the raw crypto means you understand:

- Why `timingSafeEqual` is non-negotiable
- Why algorithm confusion attacks work (the `alg` header can be changed to `none`)
- Why secrets must be high-entropy (HMAC is only as strong as the key)

**Without this understanding, you're just calling `jwt.verify()` and hoping.**
