# Thinking Process

## Mental Models

### UUID Generation Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  crypto.randomUUID() Pipeline                               │
│                                                             │
│  1. OS CSPRNG                                               │
│     (/dev/urandom on Linux,                                │
│      CryptGenRandom on Windows)                             │
│           │                                                 │
│           ▼                                                 │
│  2. Node.js crypto module                                   │
│     (reads 16 bytes from CSPRNG)                            │
│           │                                                 │
│           ▼                                                 │
│  3. UUID v4 formatting                                      │
│     - Set version nibble to 4                               │
│     - Set variant nibble to 10xx (8,9,a,b)                  │
│     - Insert hyphens at positions 8, 12, 16, 20             │
│           │                                                 │
│           ▼                                                 │
│  4. String output                                           │
│     "550e8400-e29b-41d4-a716-446655440000"                  │
└─────────────────────────────────────────────────────────────┘
```

### Collision Probability

```
┌─────────────────────────────────────────────────────────────┐
│  Birthday Paradox: How many UUIDs to get a 50% collision?  │
│                                                             │
│  UUID v4 has 122 random bits.                               │
│                                                             │
│  n = sqrt(2 * 2^122 * ln(2))                                │
│  n ≈ 2.71 × 10^18                                           │
│                                                             │
│  At 1 billion UUIDs/second:                                 │
│  Time to 50% collision = 2.71e18 / 1e9 = 2.71e9 seconds     │
│                         = ~86 years                         │
│                                                             │
│  For practical purposes: collisions are negligible.         │
└─────────────────────────────────────────────────────────────┘
```

## The Hot Path

What happens most often: a client requests a new UUID, and the server generates one. This path must be:
1. Fast (<1ms)
2. Secure (unpredictable)
3. Correct (valid format)

## The Danger Zone

1. **Using `Math.random()` instead of a CSPRNG.** `Math.random()` is NOT cryptographically secure. It is a fast, seeded PRNG designed for games and animations, not security. An attacker who observes a few UUIDs can predict future ones.

2. **Overly permissive validation.** A regex like `/^[0-9a-f-]{36}$/i` accepts strings like `gggggggg-gggg-gggg-gggg-gggggggggggg` or `00000000-0000-0000-0000-000000000000`. These are not valid UUIDs.

3. **Using UUIDs as security tokens.** While UUID v4 is unpredictable, it is not designed to be a session token. Session tokens should be generated with `crypto.randomBytes(32)` and stored in a database. UUIDs are for resource identification, not authentication.

## Question Everything

- **Do we need a database?** No. UUID generation is stateless.
- **Do we need Redis?** No. There is no shared state.
- **Do we need auth?** No. UUID generation is a public utility.
- **Do we need real-time?** No. UUIDs are generated on demand.

## The "What If" Game

- **What if 1000 users request UUIDs at once?** `crypto.randomUUID()` is stateless and O(1). It scales linearly with CPU.
- **What if the database is down?** No database; irrelevant.
- **What if a user sends garbage?** The validation endpoint rejects invalid UUIDs.
- **What if two users generate the same UUID?** The probability is 2.71e-18 per UUID. At 1 billion per second, it would take 86 years for a 50% chance of one collision.
