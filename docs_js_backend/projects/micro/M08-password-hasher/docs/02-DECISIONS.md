# M08: Password Hasher — Architecture Decisions

## Decision 1: bcrypt vs Argon2 vs scrypt vs SHA-256

### SHA-256 (And MD5, SHA-1)

| Property | Value |
|----------|-------|
| Design goal | Speed and collision resistance |
| Password suitability | ❌ None |
| Attack speed | Billions/sec on GPUs |
| Memory-hard | No |

**Verdict:** Not a password hash. Do not use.

### bcrypt

| Property | Value |
|----------|-------|
| Design goal | Adaptive cost for password hashing |
| Password suitability | ✅ Good (used since 1999) |
| Attack speed | Thousands/sec on GPUs |
| Memory-hard | Partially (4KB state, limits parallelism) |
| Max password length | 72 bytes |
| Truncation risk | Null bytes terminate input |

**Strengths:** Battle-tested, widely supported, simple API.
**Weaknesses:** Not memory-hard enough for modern GPU farms. Limited input length.

### scrypt

| Property | Value |
|----------|-------|
| Design goal | Memory-hard sequential hashing |
| Password suitability | ✅ Good |
| Attack speed | Hundreds/sec on GPUs (with high memory) |
| Memory-hard | Yes (configurable) |
| Parameters | N (iterations), r (block size), p (parallelism) |

**Strengths:** Memory-hard. Parameters tune both CPU and memory cost.
**Weaknesses:** Complex parameter selection. Less library support than bcrypt.

### Argon2 (Argon2id variant)

| Property | Value |
|----------|-------|
| Design goal | Winner of Password Hashing Competition 2015 |
| Password suitability | ✅ Best practice (OWASP 2023) |
| Attack speed | Tens–hundreds/sec on GPUs (with high memory) |
| Memory-hard | Yes (highly configurable) |
| Parameters | memory (KB), iterations, parallelism, salt length, hash length |

**Variants:**
- **Argon2d:** Fastest, data-dependent memory access. Best for cryptocurrency, risky for passwords (side-channel attacks possible).
- **Argon2i:** Data-independent memory access. Slower, resistant to side channels.
- **Argon2id:** Hybrid. First half memory-hard with data-independent access, second half data-dependent. **OWASP 2023 recommendation.**

**Verdict:** Use Argon2id for new systems. Use bcrypt if library constraints require it. Never use MD5/SHA-1/SHA-256 for passwords.

---

## Decision 2: Salt Rounds and Argon2id Parameters

### bcrypt Cost Factor

| Cost | Approx Time (2024, single core) | Use Case |
|------|--------------------------------|----------|
| 8 | ~25ms | Testing only |
| 10 | ~100ms | Minimum acceptable |
| 12 | ~400ms | Recommended |
| 14 | ~1600ms | High security, low traffic |

**OWASP 2023:** Minimum cost factor of 10. Target the highest cost your server can sustain without degrading UX.

### Argon2id Parameters

OWASP 2023 recommends two profiles:

**Profile 1 (Memory-constrained servers):**
- memory: 19 MB (19,456 KB)
- iterations: 2
- parallelism: 1

**Profile 2 (Dedicated authentication server):**
- memory: 46 MB (46,656 KB)
- iterations: 1
- parallelism: 1

**Why these numbers?**
- **Memory:** Higher memory forces GPU attackers to dedicate RAM per hash, drastically reducing parallel throughput.
- **Iterations:** Higher iterations increase CPU time. Trade off against memory based on your hardware.
- **Parallelism:** Number of parallel threads. Usually 1–4. Higher values use more CPU cores per hash.

**Tuning process:**
1. Set target time: 500ms
2. Fix memory at maximum comfortable RAM per login (e.g., 64MB)
3. Increase iterations until you hit the target time
4. Monitor server CPU/RAM under expected login load

---

## Decision 3: Memory-Hard Functions — Why They Matter

### The GPU Problem

Modern password cracking uses GPUs because they excel at parallel computation. A single RTX 4090 has 16,000+ CUDA cores.

Fast hashes (MD5, SHA-256) benefit massively from GPUs because:
- Each hash is independent
- No memory bottleneck (small state)
- Thousands of cores run simultaneously

### Memory-Hard Defense

Memory-hard functions require large amounts of RAM per hash computation. GPUs have thousands of cores but limited RAM per core (a few KB). If each hash needs 64MB:

```
GPU RAM: 24 GB
Hash memory: 64 MB
Max parallel hashes: 24,000 / 64 = 375
```

The attacker goes from 100,000 parallel hashes to 375. The attack slows by 250x.

**Key insight:** Memory is the scarce resource on GPUs. Memory-hard functions exploit this bottleneck.
