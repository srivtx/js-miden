# M08: Password Hasher — Problem, Constraints, Scope

## The Problem

Build a password hashing module for a Node.js authentication system that can:

1. **Hash** user passwords with computationally expensive, salted algorithms
2. **Verify** passwords against stored hashes in constant time
3. **Resist** rainbow table attacks, brute force, and hardware-accelerated cracking
4. **Upgrade** hash parameters over time without breaking existing users

The core challenge: passwords are low-entropy secrets (humans pick bad passwords), so they must be processed through functions that are deliberately slow and memory-hard.

---

## Why Password Hashing Is Not Encryption

| Property | Encryption | Hashing |
|----------|-----------|---------|
| Reversible? | Yes (with key) | No |
| Same input? | Same output (deterministic) | Same output only if same salt |
| Key required? | Yes | No (but salt is required) |
| Purpose | Confidentiality | Integrity + verification |

You **encrypt** credit card numbers (you need them back). You **hash** passwords (you only need to check if the user got it right).

---

## Constraints

### Functional Constraints

| Constraint | Requirement |
|-----------|-------------|
| One-way | Must be computationally infeasible to recover the original password |
| Unique per user | Same password must produce different hashes for different users |
| Constant-time verification | Must not leak information via timing side channels |
| Upgradable | Must support re-hashing with stronger parameters over time |

### Non-Functional Constraints

| Constraint | Target |
|-----------|--------|
| Hash time | 250ms–1000ms on target hardware (deliberately slow) |
| Memory cost | Configurable memory hardness (for Argon2/scrypt) |
| Parallel resistance | Should not benefit significantly from GPU/ASIC parallelism |
| Storage | Hash output ≤ 256 bytes per user |

### Scope

**In scope:**
- Password hashing and verification
- Salt generation and storage
- Algorithm selection and parameter tuning
- Timing-attack-safe comparison
- Hash upgrade strategies

**Out of scope:**
- Password policy enforcement (length, complexity)
- Multi-factor authentication
- Rate limiting / account lockout
- Password breach detection (Have I Been Pwned API integration)

---

## The Threat Model

An attacker who obtains the database (SQL injection, backup leak, insider threat) may attempt to:

1. **Rainbow table attack** — Look up precomputed hashes for common passwords
2. **Brute force** — Try billions of passwords per second on fast hardware
3. **Dictionary attack** — Try leaked passwords from other breaches
4. **Timing attack** — Measure verification time to guess password characters
5. **GPU/ASIC acceleration** — Use specialized hardware to speed up cracking

Every design decision must make these attacks economically infeasible.

---

## Success Criteria

- [ ] Hashing takes ≥ 250ms per password on production hardware
- [ ] Each user has a unique, random salt ≥ 16 bytes
- [ ] Verification uses constant-time comparison
- [ ] Algorithm is memory-hard (Argon2id, bcrypt, or scrypt)
- [ ] Hash format includes algorithm identifier and parameters for future upgrades
- [ ] System can transparently upgrade old hashes on next login
