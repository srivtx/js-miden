# The Problem

## What Are We Building?
A microservice that generates cryptographically secure UUID v4 values and validates UUID strings against the official format.

## Why Does This Problem Exist?
Every distributed system needs unique identifiers. But "unique" is not enough — identifiers must also be:
1. **Unpredictable:** An attacker who sees one ID should not be able to guess the next.
2. **Standardized:** Different services must agree on the format.
3. **Collision-resistant:** Even at massive scale, the probability of two IDs colliding must be negligible.

Before UUIDs, developers used auto-incrementing integers (`1, 2, 3...`). These are predictable (bad for security) and require a central database (bad for distributed systems). Before `crypto.randomUUID()`, developers used `Math.random()`, which is not cryptographically secure and produces predictable values.

## Who Will Use It?
- **Backend developers** who need unique IDs for resources (users, orders, sessions).
- **Security engineers** who audit whether identifiers are predictable.
- **API consumers** who need to validate UUIDs before making requests.

## Constraints
- **Time:** UUID generation must be <1ms. It is often on the hot path of resource creation.
- **Scale:** Must handle millions of UUIDs per day without collisions.
- **Correctness:** A single predictable UUID can compromise session security.
- **Budget:** Zero external services. Must work with only Node.js built-ins.

## What We're NOT Building
- We are NOT building a distributed ID generator (no Snowflake, no KSUID).
- We are NOT building a UUID v1/v3/v5 generator (only v4).
- We are NOT implementing a custom PRNG.

---

## Why UUIDs Matter

In a monolith with a single database, auto-incrementing IDs work fine. But modern systems are distributed:

```
Monolith:
┌─────────────┐
│  Database   │
│   id: 1     │
│   id: 2     │
│   id: 3     │
└─────────────┘

Distributed:
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Service A  │   │  Service B  │   │  Service C  │
│  id: ???    │   │  id: ???    │   │  id: ???    │
└─────────────┘   └─────────────┘   └─────────────┘
```

Without a shared counter, each service needs a way to generate globally unique IDs. UUID v4 solves this by using randomness from a CSPRNG (Cryptographically Secure Pseudorandom Number Generator).

```
┌─────────────────────────────────────────────────────────────┐
│  UUID v4 Structure                                          │
│                                                             │
│  xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx                       │
│                                                             │
│  Position  Meaning                                          │
│  ───────── ─────────────────────────────────────────────    │
│  13th char Version = 4 (random)                             │
│  17th char Variant = 8, 9, a, or b (RFC 4122 variant)      │
│  All other 122 bits = random                                │
└─────────────────────────────────────────────────────────────┘
```
