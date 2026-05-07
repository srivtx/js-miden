# Fundamentals: HMAC Without Libraries

**Task:** Verify a webhook signature using only Node.js `crypto`.

Given:
- Payload: JSON string
- Signature: hex string from header
- Secret: shared secret string

---

## Multiple Choice: Signature Format

**Q:** Stripe sends `Stripe-Signature: t=1234567890,v1=abc123`. What does `v1` mean?

**A)** Version 1 of the signing scheme

**B)** First 4 bytes of the signature

**C)** A random nonce

**D)** The signature algorithm (HMAC-SHA256)

**Think before reading on.**

---

## The Answer

**A is correct.**

The `v1` prefix allows Stripe to rotate signing schemes. If they introduce `v2`, they can send both:
```
Stripe-Signature: t=123,v1=oldsig,v2=newsig
```

This provides a transition period where both schemes are valid.

**The signed payload includes the timestamp:**
```javascript
const signedPayload = timestamp + '.' + payload;
const signature = hmac(signedPayload, secret);
```

This prevents replay attacks (old signatures with new timestamps fail).
