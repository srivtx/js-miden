# Impossible Constraint: No `jsonwebtoken` Library, No `crypto` Module

**The constraint:** You can only use Node.js built-ins EXCEPT `crypto`. No HMAC. No SHA256.

**The task:** Build a token system that:
1. Proves the token wasn't tampered with
2. Has an expiry
3. Can be validated without a database lookup

---

## Your Turn: Sketch a Solution

Before reading on, think about how you'd do this.

**Hints:**
- You CAN use `Buffer`, `JSON.stringify`, `Date.now()`
- You CANNOT use any hashing
- The token needs to be "verifiable" but you can't verify a signature without crypto

**Write your approach here:**

<br><br><br><br><br>

---

## The Reveal: It's Impossible (And That's The Point)

Without cryptography, you cannot build a stateless, tamper-proof token.

Any "solution" you came up with is vulnerable:
- **Base64 + secret prefix:** Attacker can decode, modify, re-encode
- **Checksum of characters:** Attacker can recalculate
- **Timestamp + random:** Attacker can forge

**This constraint forces you to realize:**

> JWTs rely on cryptographic primitives. Without them, you're just passing around JSON that anyone can forge.

The "stateless" benefit of JWTs ONLY works because HMAC provides integrity. If you remove the crypto, you remove the security.

**Real-world implication:** When someone says "JWTs are insecure," they usually mean "people use JWTs without understanding the crypto requirements." The problem isn't JWTs. It's skipping the crypto.
