# Impossible Constraint: No Hash Function

**Task:** Distribute users evenly into 100 buckets without any hash function.

**Constraint:** No `crypto`, no `hashCode`, no modulo.

---

## Your Turn

How do you deterministically assign users to buckets without hashing?

**Write your approach:**

<br><br><br><br><br>

---

## The Reveal: You Can't (Well)

Without hashing, you have:
- **Alphabetical:** A-M get variant A, N-Z get B. Not even.
- **Length-based:** Short names vs long names. Not even.
- **Database ID ranges:** Early users vs late users. Not even.

**The point:** You need a function that scrambles input uniformly. That's what hashes do.

**Without crypto, you could use:**
- A simple checksum (better than nothing)
- A lookup table (doesn't scale)
- A PRNG seeded with user ID (basically a hash)

**This constraint forces you to realize:**

> Hashing isn't overengineering for feature flags. It's the minimum requirement for fair distribution.
