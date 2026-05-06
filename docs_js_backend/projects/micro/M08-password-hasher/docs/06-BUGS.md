# M08: Password Hasher — Bug Deep Dive

## Bug 1: SHA-256 Without Salt

### The Vulnerable Code

```typescript
import { createHash } from 'crypto';

export function hashPasswordUnsafe(password: string): string {
  return createHash('sha256').update(password).digest('hex');
  // Output: 5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8
}
```

### Why It Exists

Developers know "don't store plaintext passwords" and reach for the first one-way function they know: SHA-256. It is built into Node.js, well-documented, and "cryptographic." They do not realize it is the wrong tool for the job.

---

## The Attack: Rainbow Table

### Building a Rainbow Table

A rainbow table is a time-memory tradeoff attack. Instead of computing hashes on the fly, the attacker precomputes hashes for millions of common passwords.

```python
# Simplified rainbow table generation
rainbow_table = {}
for password in wordlist:  # 10 billion entries
    hash = sha256(password)
    rainbow_table[hash] = password
```

This takes weeks to build but only seconds to query.

### The Attack Execution

1. **Attacker obtains database dump:**
   ```
   username | password_hash
   ---------|----------------------------------
   alice    | 5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8
   bob      | ef92b768b01529dd3af9f7c979edf6c1c1c5d4c5c5c5c5c5c5c5c5c5c5c5c5c5
   ```

2. **Attacker looks up hashes in rainbow table:**
   ```
   5e884898da... → "password"
   ef92b768b0... → "123456"
   ```

3. **Result:** Without computing a single hash during the attack, 60% of accounts are compromised.

### Why Salt Defeats It

With a unique salt per user:

```
alice: salt=a3f7, hash=sha256("password" + "a3f7") = 9b2c...
bob:   salt=8c1d, hash=sha256("password" + "8c1d") = 7d4e...
```

The attacker would need a separate rainbow table for **every possible salt** (2^128 tables for 128-bit salts). This is physically impossible.

**Note:** Salt does not prevent brute force. It prevents precomputation. The attacker must still try `password` + `a3f7`, `password` + `8c1d`, etc., one at a time.

---

## Bug 2: Timing Attack via `===` Comparison

### The Vulnerable Code

```typescript
export function verifyPasswordUnsafe(input: string, storedHash: string): boolean {
  const inputHash = createHash('sha256').update(input).digest('hex');
  return inputHash === storedHash;  // 🔴 TIMING LEAK
}
```

### The Attack Mechanics

The `===` operator in V8 (Node.js engine) compares strings character by character and returns immediately on the first mismatch.

**Scenario:**
- Stored hash: `aabbccdd...` (64 hex chars)
- Attacker sends: `00000000...` (64 zeros)

**Comparison:**
1. `0 === a`? No → return false immediately (~1ns)

**Attacker sends:** `a0000000...`
1. `a === a`? Yes
2. `0 === a`? No → return false (~2ns)

The response is **1 nanosecond slower**. Over thousands of requests, the attacker detects that the first character is `a`.

**Next guess:** `aa000000...`
1. `a === a`? Yes
2. `a === a`? Yes
3. `0 === b`? No → return false (~3ns)

The attacker now knows the first two characters are `aa`. Repeating this 64 times reconstructs the full hash.

### Real-World Feasibility

Network jitter (milliseconds) dwarfs nanosecond timing differences. However:
- Local attacks (same datacenter): Timing differences are measurable
- Long-running hash functions: Early-exit savings are larger
- Statistical analysis: Averaging thousands of requests filters out noise

### The Fix: Constant-Time Comparison

```typescript
import { timingSafeEqual } from 'crypto';

export function verifyPasswordSafe(input: string, storedHash: string): boolean {
  const inputHash = createHash('sha256').update(input).digest('hex');

  const bufA = Buffer.from(inputHash, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');

  if (bufA.length !== bufB.length) {
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}
```

This ensures the comparison always takes the same time, regardless of how many characters match.

### Even Better: Don't Compare Hashes at All

Modern password hashing libraries (argon2, bcrypt) handle verification internally with constant-time comparison. You should never manually compare password hashes.

```typescript
// Correct
return await argon2.verify(storedHash, inputPassword);

// Wrong
const inputHash = await argon2.hash(inputPassword);
return inputHash === storedHash;  // Timing leak + salt mismatch!
```

---

## Combined Bug Scenario

A system using **SHA-256 without salt** AND **timing-unsafe comparison**:

1. Attacker breaches database
2. Attacker builds rainbow table for SHA-256
3. 60% of passwords cracked instantly (no salt)
4. For the remaining 40%, attacker uses timing attack to recover hashes faster than brute force
5. Combined with dictionary attack on the cracked passwords, attacker profiles users for credential stuffing on other sites

**Remediation cost:** Mass password reset, regulatory notification, reputation damage, potential fines (GDPR, CCPA).
