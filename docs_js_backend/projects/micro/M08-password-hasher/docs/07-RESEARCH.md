# M08: Password Hasher — Latest Trends & Research

## OWASP 2023 Password Storage Cheat Sheet

The OWASP Cheat Sheet Series (2023 update) explicitly recommends:

1. **Use Argon2id** with:
   - Minimum memory: 19 MB (constrained) or 46 MB (dedicated)
   - Minimum iterations: 1–2
   - Minimum parallelism: 1

2. **If Argon2id is unavailable, use scrypt** with:
   - N ≥ 2^15 (32768)
   - r ≥ 8
   - p ≥ 1

3. **If scrypt is unavailable, use bcrypt** with:
   - Cost factor ≥ 10 (preferably 12+)

4. **Never use:** MD5, SHA-1, SHA-256, SHA-3, or any general-purpose hash for passwords

5. **Always use a unique salt** per password (automatic in bcrypt/Argon2id)

6. **Consider a pepper** as additional defense-in-depth

---

## Hardware Acceleration Arms Race

### Current State (2024)

| Hardware | MD5 Hashes/Sec | bcrypt (cost 12) | Argon2id (64MB) |
|----------|---------------|------------------|-----------------|
| CPU (1 core) | 10M | 100 | 1 |
| GPU (RTX 4090) | 100B | 100K | 1K |
| FPGA cluster | 1T | 500K | 5K |
| ASIC (custom) | 100T | Negligible (limited by memory) | Negligible |

**Key insight:** ASICs crush fast hashes (MD5/SHA-256) but struggle with memory-hard functions. Memory is expensive in silicon; you cannot parallelize RAM the way you parallelize logic gates.

---

## Memory-Hard Function Design

### Why Memory Matters

GPU cracking efficiency is measured in hashes per dollar. Memory-hard functions increase the dollar cost per hash by requiring RAM that cannot be shared across parallel cores.

**The math:**
- GPU: 24 GB RAM, 16,000 cores
- Fast hash: 1 KB state → 16,000 parallel hashes
- Memory-hard hash: 64 MB state → 375 parallel hashes
- Slowdown: 42x fewer parallel hashes

At higher memory (256 MB):
- Parallel hashes: 94
- Slowdown: 170x

### Future-Proofing Parameters

OWASP recommends increasing memory and iterations as hardware improves. A reasonable rule:

> Double the memory cost every 2–3 years, or when your server's hash time drops below 250ms.

---

## Post-Quantum Considerations

Quantum computers (using Grover's algorithm) can theoretically search hash inputs in O(2^(n/2)) instead of O(2^n). For a 256-bit hash, this reduces security to 128 bits.

**Impact on password hashing:**
- Current passwords have far less than 128 bits of entropy
- Grover's algorithm provides less advantage against slow hashes than against fast hashes
- Argon2id's memory hardness is not directly affected by quantum speedups

**Verdict:** Password hashing is not the primary concern for post-quantum cryptography. Focus on longer passwords and higher work factors.

---

## Emerging: Threshold Password Hashing

Research into distributing password hashing across multiple servers:
- User password is split into shares
- Each server hashes its share
- Threshold scheme requires t-of-n servers to verify

**Benefit:** Even if n-1 servers are compromised, the password hash remains secure.

**Status:** Academic research. No production-ready libraries yet.

---

## Breach Detection and Response

### Have I Been Pwned API

Before accepting a password during registration, check if it has appeared in known breaches:

```typescript
async function isPwnedPassword(password: string): Promise<boolean> {
  const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  const text = await response.text();

  return text.includes(suffix);
}
```

**Privacy-preserving:** Only the first 5 characters of the SHA-1 hash are sent. The API returns a list of suffixes that match the prefix.

### Canary Tokens

Insert fake user accounts with easily guessable passwords into your database. Monitor login attempts on these accounts. Any login indicates a database breach (since no real user should know these passwords).

---

## Regulation and Compliance

| Standard | Password Requirement |
|----------|---------------------|
| NIST SP 800-63B | Minimum 8 characters, check against breached passwords, no complexity requirements |
| GDPR | Strong security measures; breach notification within 72 hours |
| PCI-DSS 4.0 | Strong cryptography for stored passwords; minimum 7 characters |
| OWASP ASVS | Level 2: bcrypt/Argon2id/scrypt; Level 3: Argon2id with memory ≥ 64MB |

NIST explicitly **rejects** traditional complexity rules (uppercase + number + symbol) because they encourage predictable patterns (`Password1!`).
