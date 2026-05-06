# M08: Password Hasher — Mental Models & Danger Zones

## Mental Model 1: Password Hashing Is Insurance

You don't buy insurance because you expect a crash. You buy it because crashes are catastrophic and unpredictable.

Hashing passwords with strong parameters is insurance against a database breach. If the breach never happens, the hashing cost is "wasted" — but if it does happen, strong hashing is the difference between "we reset all passwords" and "all user accounts are compromised."

**Key insight:** The cost of hashing is paid on every login. The benefit is realized only during a breach. Optimize for the breach scenario, not the happy path.

---

## Mental Model 2: Attackers Have Better Hardware Than You

Your server hashes one password at a time. An attacker with a GPU rig can test billions of hashes per second — if the hash function is fast.

**Benchmark (2024, single RTX 4090):**
- MD5: ~100 billion hashes/sec
- SHA-256: ~20 billion hashes/sec
- bcrypt (cost 10): ~100,000 hashes/sec
- Argon2id (memory=64MB): ~1,000 hashes/sec

A fast hash function is an attacker's best friend. A slow, memory-hard function levels the playing field.

---

## Mental Model 3: The Salt Is Not a Secret

Developers often ask: "Should I store the salt in a separate database?"

No. The salt is **public** by design. Its job is not secrecy — its job is **uniqueness**. Even if the attacker knows the salt, they must recompute the hash for each user individually. The salt defeats precomputation (rainbow tables), not brute force.

**Key insight:** Store the salt right next to the hash. The security does not come from hiding the salt.

---

## Danger Zone 1: Fast Hash Functions (MD5, SHA-1, SHA-256)

Using SHA-256 without salt:

```javascript
const hash = crypto.createHash('sha256').update(password).digest('hex');
```

This is **cryptographically broken** for password storage:
- SHA-256 is designed to be fast (billions/sec on GPUs)
- Without salt, identical passwords have identical hashes
- Rainbow tables exist for common passwords

**Rule:** Never use MD5, SHA-1, SHA-256, or any general-purpose hash for passwords.

---

## Danger Zone 2: Homegrown Algorithms

```javascript
function myHash(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) - hash) + password.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
```

This is not just weak — it is **trivially reversible** for short passwords. Rolling your own crypto is one of the fastest ways to compromise user data.

**Rule:** Use established, peer-reviewed algorithms: bcrypt, scrypt, Argon2id.

---

## Danger Zone 3: Timing Attacks via `===`

```javascript
function verifyPassword(input, storedHash) {
  const inputHash = hash(input);
  return inputHash === storedHash;  // 🔴 TIMING LEAK
}
```

The `===` operator in JavaScript returns `false` as soon as it finds a mismatching character. An attacker can measure response times to guess the hash one byte at a time.

**Rule:** Always use constant-time comparison for secrets and hashes.

---

## Danger Zone 4: Insufficient Salt Rounds / Memory

```javascript
bcrypt.hash(password, 4);  // Too fast (~1ms)
```

OWASP recommends bcrypt cost ≥ 10 (which takes ~100–250ms on modern hardware). Lower costs are only acceptable for testing.

For Argon2id, insufficient memory (e.g., 8KB) allows GPU attackers to run many parallel instances. You need enough memory to saturate the attacker's RAM budget.

**Rule:** Tune parameters on your production hardware. Target 250ms–1000ms per hash.

---

## Danger Zone 5: Pepper Without Salt

A **pepper** is a secret key added to the password before hashing, stored separately from the database (e.g., in environment variables or HSM).

```javascript
const hash = bcrypt.hash(password + PEPPER, 12);
```

If you use a pepper but **no salt**, identical passwords still produce identical hashes (within the same pepper). The pepper alone does not defeat rainbow tables across users.

**Rule:** Always use salt. Pepper is an optional additional layer, not a replacement.

---

## Danger Zone 6: Storing Password History Incorrectly

Some systems store old passwords to prevent reuse. If stored as plaintext or weak hashes, a database breach exposes the user's entire password history — a goldmine for attackers profiling that user across services.

**Rule:** Store password history with the same strong hashing used for the current password.
