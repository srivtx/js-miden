# S13 API Key Manager — Architecture

## Decision: SHA-256 vs. bcrypt vs. Argon2 for API Keys

### SHA-256 (Chosen for Production API Keys)
- **Pros**: Fast (microseconds), deterministic, easy to implement, supports prefix searching.
- **Cons**: Not slow; vulnerable to brute-force if the secret is low-entropy.
- **Verdict**: Correct for high-entropy machine-generated keys (256+ bits). Rainbow tables are infeasible.

### bcrypt (Chosen for User Passwords)
- **Pros**: Slow by design (~100ms), resistant to brute-force and rainbow tables.
- **Cons**: Too slow for high-throughput API authentication (adds latency to every request), truncates input to 72 bytes.
- **Verdict**: Wrong for API keys; correct for human passwords.

### Argon2 (Modern Password Hashing)
- **Pros**: Memory-hard, winner of Password Hashing Competition.
- **Cons**: Even slower than bcrypt; overkill for API keys.
- **Verdict**: Use for passwords, not API keys.

**Rule of thumb**: Slow hashes (bcrypt, Argon2, PBKDF2) are for human passwords. Fast hashes (SHA-256, SHA-512, BLAKE2) are for machine-generated high-entropy secrets.

## Decision: Key Prefixes

### `pk_live_` vs `pk_test_`
- **Environment separation**: Test keys cannot accidentally hit production endpoints if the middleware checks the prefix.
- **Visual distinction**: Developers immediately know which environment a key belongs to.
- **Leak detection**: If a `pk_test_` key appears in production logs, it's a clear misconfiguration.

### Alternatives
- **No prefix**: Keys are opaque blobs. Harder to debug and validate.
- **Environment in metadata**: Requires a database lookup to determine environment. Slower and error-prone.

## Decision: Rate Limiting Strategy

### In-Memory Map (Current)
- **Pros**: Zero dependencies, sub-millisecond checks.
- **Cons**: Lost on process restart, does not scale horizontally, memory grows unbounded.
- **Verdict**: Fine for single-node deployments.

### Redis (Sliding Window)
- **Pros**: Shared across processes, supports distributed rate limiting, TTL auto-cleanup.
- **Cons**: Requires Redis, network latency.
- **Verdict**: Required for multi-node production systems.

### Token Bucket (Leaky Bucket)
- **Pros**: Allows short bursts while enforcing long-term averages.
- **Cons**: More complex to implement correctly.
- **Verdict**: Best for APIs with bursty traffic patterns.

## Decision: Scoping vs. All-Or-Nothing Keys

### Scoped Keys (Current Schema Supports)
```json
["read:users", "write:posts"]
```
- **Pros**: Principle of least privilege, fine-grained audit trail.
- **Cons**: More complex middleware, harder UX for developers.

### All-Or-Nothing Keys
- **Pros**: Simple to understand and use.
- **Cons**: A leaked key grants full API access.
- **Verdict**: Acceptable for simple internal APIs; dangerous for public platforms.
