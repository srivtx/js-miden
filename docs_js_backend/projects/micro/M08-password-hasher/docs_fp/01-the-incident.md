# The 3AM Page: The Rainbow Table

It's 4:12 AM. Your phone buzzes.

**PagerDuty:** `[CRITICAL] User database leaked`

You check the news. A hacker forum post: "50M user credentials from [YourApp]. Plaintext passwords. Have fun."

You check your code:

```javascript
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}
```

No salt. No stretching. Just raw SHA-256.

An attacker with a $500 GPU can crack **10 billion SHA-256 hashes per second**. Your entire user base is compromised in hours.

---

## Your Turn

### Q1: Why is SHA-256 without salt so fast to crack?

Think about what SHA-256 is designed for. Is it designed for passwords?

<br><br><br><br><br>

---

## The Autopsy

### Answer: SHA-256 is designed for speed

SHA-256 is a **general-purpose hash**. It's designed to be fast — for file integrity, blockchain, certificates. Fast is the opposite of what you want for passwords.

**A password hash should be slow.** So slow that cracking one password takes 100ms. At that speed, even a million-password dictionary takes 28 hours.

**But SHA-256 computes in microseconds.** An attacker tries billions per second.

### The Salt Problem

Without salt, identical passwords have identical hashes. If 10,000 users use "password123", all 10,000 have the same hash. Crack once, exploit 10,000 times.

**Rainbow tables** are precomputed hash databases. An attacker doesn't even need to compute hashes — they just look them up.

**The fix:**
- **Salt:** Random 16-byte string per user. Same password → different hash.
- **Stretching:** Iterate the hash 100,000 times. Slow by design.
- **Memory-hard:** Use memory-intensive algorithms (Argon2) so GPUs don't help.

---

### Q2: Why not encrypt passwords?

Encryption is reversible. If the key leaks, all passwords are exposed.

Hashing is one-way. Even if the database leaks, the attacker can't reverse the hash (without brute force).

**Rule:** Never encrypt passwords. Always hash.
