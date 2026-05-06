# M08: Password Hasher — Old vs Modern

## The Evolution of Password Hashing

### Phase 1: Plaintext (Pre-1970s to 1990s)

```
Username: alice
Password: password123
```

Stored directly in the database. A breach = total compromise.

**Why it happened:** Early systems had no security culture. Passwords were treated like any other data field.

---

### Phase 2: MD5 and SHA-1 (1990s–2000s)

```javascript
const hash = crypto.createHash('md5').update(password).digest('hex');
// 5f4dcc3b5aa765d61d8327deb882cf99
```

**Why it seemed good:**
- One-way (can't reverse the hash)
- Fast to compute
- Standard algorithms

**Why it is broken:**
- **Fast:** GPUs crack billions per second
- **No salt:** Identical passwords = identical hashes
- **Vulnerable to rainbow tables:** Precomputed tables exist for MD5 and SHA-1
- **Collision attacks:** MD5 is cryptographically broken; SHA-1 is weakened

**Real-world impact:**
- LinkedIn (2012): 6.5M SHA-1 hashes leaked. 60% cracked in hours.
- RockYou (2009): 32M plaintext passwords leaked, fueling rainbow tables for a decade.

---

### Phase 3: bcrypt (2010s)

```javascript
const hash = await bcrypt.hash(password, 10);
// $2b$10$N9qo8uLOickgx2ZMRZoMye...
```

**Why it was revolutionary:**
- **Adaptive cost:** Increase `cost` factor as hardware improves
- **Built-in salt:** Automatically generates and embeds salt
- **Slow by design:** ~100ms per hash at cost 10
- **Memory pressure:** 4KB of L1/L2 cache per hash limits GPU parallelism

**Limitations:**
- Max password length: 72 bytes
- Null byte truncation vulnerability
- Not truly memory-hard (4KB is small for modern GPUs)

**OWASP 2017 recommendation:** bcrypt with cost ≥ 10.

---

### Phase 4: scrypt (2012–2020)

```javascript
const hash = scrypt.syncScrypt(password, salt, N, r, p, dkLen);
```

**Improvements over bcrypt:**
- Configurable memory usage
- Parallelism parameter `p`
- Better GPU resistance at high memory settings

**Challenges:**
- Complex parameter tuning
- Less widespread library support than bcrypt
- Some implementations had timing side channels

---

### Phase 5: Argon2id (2015–Present, OWASP 2023 Recommendation)

```javascript
const hash = await argon2.hash(password, {
  type: argon2id,
  memoryCost: 65536,  // 64 MB
  timeCost: 3,        // iterations
  parallelism: 4,     // threads
});
// $argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$...
```

**Why Argon2id is the current gold standard:**

1. **Memory-hard:** Configurable RAM usage (16MB–1GB+). GPUs cannot run thousands in parallel.
2. **Resistant to side-channel attacks:** Argon2i's data-independent memory access + Argon2d's GPU resistance.
3. **Winner of Password Hashing Competition 2015:** Extensively peer-reviewed.
4. **OWASP 2023:** Explicitly recommends Argon2id.

**Benchmark Comparison (RTX 4090, 2024):**

| Algorithm | Hashes/Sec | Time to Crack Top 10M Passwords |
|-----------|-----------|--------------------------------|
| MD5 | 100,000,000,000 | 0.1 seconds |
| SHA-256 | 20,000,000,000 | 0.5 seconds |
| bcrypt (cost 12) | 100,000 | 100 seconds |
| Argon2id (64MB) | 1,000 | 2.8 hours |
| Argon2id (256MB) | 250 | 11 hours |

**Key insight:** The gap between MD5 and Argon2id is **8 orders of magnitude** (100 million times slower). This is the difference between "cracked instantly" and "cracked never."

---

## Migration Path

If you currently store MD5 or SHA-256 hashes:

### Phase 1: Transparent Re-Hashing

On next successful login:
1. Verify against old hash (MD5/SHA-256)
2. If valid, immediately re-hash with Argon2id
3. Update database record
4. Delete old hash

```typescript
async function verifyAndUpgrade(user, password) {
  if (user.hash.startsWith('$argon2id')) {
    return await argon2.verify(user.hash, password);
  }

  // Legacy SHA-256 verification
  if (legacyVerify(password, user.hash)) {
    // Re-hash with Argon2id
    user.hash = await argon2.hash(password, ARGON2_CONFIG);
    await user.save();
    return true;
  }

  return false;
}
```

### Phase 2: Force Password Reset for Inactive Accounts

After 6 months, email users who haven't logged in and haven't been upgraded. Force a password reset on next login.

### Phase 3: Delete Legacy Hashes

After 12 months, delete any remaining legacy hashes. Users must use "forgot password" to regain access.

---

## Modern Storage Format

Use the **Modular Crypt Format (MCF)** or algorithm-specific encoded strings that include all parameters:

```
$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG
└─┬────┘ └┬┘ └┬────┘└┬┘└┬┘ └─────┬────┘ └────────────────────┬─────────────────────┘
  algo    version memory  iters parallelism      salt                 hash
```

**Benefit:** You can upgrade parameters over time without a schema migration. The verifier reads the embedded parameters.
