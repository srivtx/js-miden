# The Principle: What Did Password Hashing Teach You?

## The Fundamental Truth

> **"Passwords prove identity. Hashes prove the password without revealing it. If you can reverse the hash, you don't have a hash — you have encryption."**

## The Junior Question

A junior dev says: "We use AES-256 to encrypt passwords. That's military-grade security!"

**What's wrong with this?**

<br><br><br><br><br>

---

## The Answer

Encryption is reversible. If the key leaks, every password is exposed instantly.

Hashing is one-way. Even with the database, an attacker must brute-force each password individually.

**"Military-grade encryption" for passwords is actually LESS secure than a properly configured hash.**

## The Realization

Password security isn't about using the "best" algorithm. It's about:
1. **Using the RIGHT algorithm** (slow, memory-hard)
2. **Using it correctly** (unique salt, proper comparison)
3. **Planning for failure** (assume the database will leak)

When (not if) your database leaks, you want the attacker to face:
- Unique salts per user
- 100ms per hash attempt
- Billions of possible combinations

That's what buys you time to notify users and force password resets.
