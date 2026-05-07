# Impossible Constraint: No `crypto` Module

**Task:** Store passwords so they can't be stolen... without any hashing.

**Constraint:** You cannot use `crypto`, `bcrypt`, `argon2`, or any hashing library.

---

## Your Turn

How do you store passwords without hashing?

**Rules:**
- You can't hash (no one-way function)
- You need to verify passwords later
- The database might leak

**Write your approach:**

<br><br><br><br><br>

---

## The Reveal: It's Impossible

Without one-way functions, any stored password can be reversed:
- **Plaintext:** Obviously reversible
- **XOR with key:** Reversible if key is known
- **Base64:** Just encoding, not encryption
- **Character substitution (Caesar cipher):** Trivial to reverse

**The fundamental truth:**

> Password verification requires a one-way function. Without it, you're just hiding the password behind a thin veil.

This is why every password storage system uses hashing. It's not a choice — it's a mathematical necessity.

**The constraint forces you to realize:**

When someone says "we don't need bcrypt, we can just [simple scheme]," they're trying to solve an impossible problem. Hashing isn't overengineering. It's the minimum viable security.
