# 03-CONCEPTS

## Entropy in Short Codes
- **WHAT**: Randomness that makes codes hard to guess.
- **WHY**: Low entropy allows enumeration attacks, exposing private links and user data.
- **HOW**: Use cryptographically secure random generators (Node `crypto.randomBytes` or `nanoid`).
- **WRONG**: Auto-incrementing integer mapped to Base62.
- **RIGHT**: `nanoid(10)` or `crypto.randomBytes(6).toString('base64url')`.

## Rate Limiting
- **WHAT**: Restricting operations per time window per client.
- **WHY**: Prevents abuse, brute-force custom codes, and DB filling.
- **HOW**: `express-rate-limit` with Redis store for distributed deployments.
- **WRONG**: In-memory rate limit on a single server behind a load balancer.
- **RIGHT**: Redis-backed rate limiter keyed by IP or user ID.

## Analytics Fire-and-Forget
- **WHAT**: Recording metrics without blocking the hot path.
- **WHY**: Redirect latency is critical; analytics writes can be slow.
- **HOW**: Insert click row after sending the redirect, or enqueue to a queue.
- **WRONG**: `await db.insertClick(); res.redirect(url);` in series.
- **RIGHT**: `res.redirect(url); db.insertClick().catch(() => {});`.
