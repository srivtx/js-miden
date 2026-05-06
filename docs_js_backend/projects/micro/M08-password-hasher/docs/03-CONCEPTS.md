# M08: Password Hasher — Deep Concepts

## Cryptographic Hashing vs Password Hashing

A cryptographic hash function (SHA-256) has these properties:
1. **Deterministic:** Same input → same output
2. **Fast:** Billions of operations per second
3. **Collision-resistant:** Hard to find two inputs with same hash
4. **Preimage-resistant:** Hard to find input from hash

For passwords, properties 1 and 2 are **bugs**, not features:
- Deterministic output lets attackers precompute hashes
- Fast computation lets attackers brute-force quickly

Password hashing functions (bcrypt, Argon2id) intentionally violate these:
1. **Non-deterministic:** Salt ensures different output for same password
2. **Slow:** Configurable time cost (250ms–1000ms per hash)
3. **Memory-hard:** Large RAM requirement per hash

---

## Salt: What It Is and Why It Works

### Definition

A **salt** is a random, unique value added to each password before hashing. It is stored alongside the hash.

```
hash = argon2(password + salt, parameters)
stored = algorithm$salt$hash
```

### Example Without Salt

| User | Password | SHA-256 Hash |
|------|----------|--------------|
| alice | password123 | ef92b768b... |
| bob | password123 | ef92b768b... |

An attacker precomputes the hash of `password123` once and cracks both accounts instantly.

### Example With Salt

| User | Salt | Password | Hash |
|------|------|----------|------|
| alice | a3f7... | password123 | b9e2... |
| bob | 8c1d... | password123 | 4f7a... |

Same password, different hashes. The attacker must crack each account separately.

### Rainbow Tables: The Attack Salt Defeats

A **rainbow table** is a precomputed table of password → hash mappings. Building it takes enormous time and space, but looking up a hash is instant.

**Without salt:**
1. Attacker downloads leaked database of 100M hashes
2. Attacker has rainbow table for top 10B passwords
3. Attacker looks up each hash in the table
4. In minutes, 60% of accounts are cracked

**With salt:**
1. Attacker downloads leaked database
2. Rainbow table is useless — each hash uses a different salt
3. Attacker must brute-force each hash individually
4. At 1000 hashes/sec (Argon2id), cracking 100M accounts takes 3+ years

**Key insight:** Salt does not make brute force impossible. It makes precomputation (rainbow tables) impossible.

---

## Pepper: What It Is

A **pepper** is a secret key added to every password before hashing, stored **outside** the database (e.g., environment variable, HSM).

```javascript
const hash = argon2(password + pepper, { salt });
```

### Salt vs Pepper

| Property | Salt | Pepper |
|----------|------|--------|
| Unique per user? | Yes | No (global secret) |
| Stored with hash? | Yes | No (separate secret store) |
| Defeats rainbow tables? | Yes | Indirectly (adds entropy) |
| If database leaks? | Hash is still secure | Hash is secure unless pepper also leaks |
| Rotation difficulty? | None (per-user) | Hard (must re-hash all users) |

**Verdict:** Use salt always. Add pepper as a defense-in-depth layer if you have a secure secret management system (HashiCorp Vault, AWS KMS, etc.). Do not rely on pepper alone.

---

## Brute Force Attacks and Moore's Law

### The Math

A password with:
- 8 lowercase letters: 26^8 = 208 billion combinations
- 8 mixed case + digits: 62^8 = 218 trillion combinations
- 12 mixed case + digits + symbols: 95^12 = 540 sextillion combinations

At 100 billion hashes/sec (SHA-256 on GPU):
- 8 lowercase: 2 seconds
- 8 mixed: 36 minutes
- 12 mixed: 171,000 years

At 1,000 hashes/sec (Argon2id):
- 8 lowercase: 6.6 years
- 8 mixed: 6,900 years
- 12 mixed: 17 billion years

### Moore's Law

Computing power doubles roughly every 2 years. A hash that takes 1 second today will take 0.5 seconds in 2 years. Attackers get faster; passwords don't get stronger.

**Adaptive hashing** (bcrypt's cost factor, Argon2id's parameters) solves this by allowing you to increase the work factor over time.

```
2015: bcrypt cost 10 → 100ms
2020: bcrypt cost 12 → 400ms
2024: bcrypt cost 13 → 800ms
```

---

## Timing Attacks and Constant-Time Comparison

### The Vulnerability

```javascript
function unsafeCompare(a, b) {
  return a === b;  // Returns early on first mismatch
}
```

If `a = 'hello'` and `b = 'hallo'`, JavaScript compares:
1. `h === h` ✓
2. `e === a` ✗ → returns `false` immediately

An attacker who can measure the **response time** can determine how many leading characters are correct. Over many requests, they can reconstruct the secret character by character.

### Timing Attack Code Example

```javascript
async function timingAttack() {
  const target = 'secret_password';
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let guess = '';

  for (let pos = 0; pos < 15; pos++) {
    let bestChar = '';
    let bestTime = 0;

    for (const c of chars) {
      const test = guess + c;
      const start = performance.now();

      // Run many times to average out noise
      for (let i = 0; i < 10000; i++) {
        unsafeCompare(target, test);
      }

      const elapsed = performance.now() - start;
      if (elapsed > bestTime) {
        bestTime = elapsed;
        bestChar = c;
      }
    }

    guess += bestChar;
    console.log(`Position ${pos}: ${guess}`);
  }
}
```

### Constant-Time Comparison

```javascript
function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
```

This function:
1. Always compares all characters (no early return)
2. Uses XOR (`^`) to detect differences
3. ORs the results so the final comparison happens once
4. Takes the same time regardless of match position

**In Node.js:** Use `crypto.timingSafeEqual()` which is implemented in C and resistant to compiler optimizations that might remove the constant-time property.

```javascript
import { timingSafeEqual } from 'crypto';

const bufA = Buffer.from(hashA, 'hex');
const bufB = Buffer.from(hashB, 'hex');

if (bufA.length !== bufB.length) return false;
return timingSafeEqual(bufA, bufB);
```

**Critical:** `timingSafeEqual` requires equal-length buffers. Never compare hex strings of different lengths directly — normalize first.
