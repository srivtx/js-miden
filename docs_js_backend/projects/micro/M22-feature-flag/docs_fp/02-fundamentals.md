# Fundamentals: Consistent Hashing from Scratch

**Task:** Assign users to buckets deterministically.

Given:
- userId: "user-123"
- flag: "new-header"
- buckets: 100

---

## Multiple Choice: Hash Function

**Q:** Why SHA-256 instead of simple hash like `userId.length % 100`?

**A)** SHA-256 is faster

**B)** Simple hash creates uneven distribution

**C)** SHA-256 is more secure

**D)** No real difference

**Think before reading on.**

---

## The Answer

**B is correct.**

`userId.length % 100`:
- Most user IDs are 8-12 characters
- Results cluster around 8-12, not 0-99
- Terrible distribution

**SHA-256:**
- Cryptographic hash = uniform distribution
- Every bit of input affects every bit of output
- No clustering, no patterns

**You don't need crypto security. You need uniform distribution.**
