# Idempotency Patterns

## The Problem
A client sends a `POST /charge` request. The server processes it, but the network times out before the response reaches the client. The client retries. Without idempotency, the customer is **charged twice**.

## Real Breach Story: Stripe Double-Charges (2015)
In 2015, a bug in Stripe's idempotency system caused **duplicate charges** for some merchants. The root cause was a race condition: two identical requests arrived simultaneously, both checked for the idempotency key before either wrote the result, and both proceeded to charge.

**Lesson**: Idempotency checks must be **atomic**.

## Idempotency Key Pattern

The client generates a unique key (UUID) for each logical operation. The server stores the key and the result. Duplicate requests with the same key return the stored result without re-executing.

### Sequence Diagram

```
Client                          API Server                    Payment Gateway
  │                                 │                              │
  │──POST /charge──────────────────▶│                              │
  │  Idempotency-Key: key_123       │                              │
  │                                 │                              │
  │                                 │──check key in Redis─────────▶│
  │                                 │◀──not found──────────────────│
  │                                 │                              │
  │                                 │──charge card────────────────▶│
  │                                 │◀──success────────────────────│
  │                                 │                              │
  │                                 │──store result + key─────────▶│
  │                                 │   (TTL = 24 hours)           │
  │                                 │                              │
  │◀──200 OK + result───────────────│                              │
  │                                 │                              │
  │  [Network timeout]              │                              │
  │                                 │                              │
  │──POST /charge (retry)──────────▶│                              │
  │  Idempotency-Key: key_123       │                              │
  │                                 │                              │
  │                                 │──check key in Redis─────────▶│
  │                                 │◀──found + result─────────────│
  │                                 │                              │
  │◀──200 OK + cached result────────│                              │
  │                                 │                              │
  │  [No duplicate charge!]         │                              │
```

## Implementation with Redis

```typescript
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

const IDEMPOTENCY_TTL = 86400; // 24 hours

async function withIdempotency<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const lockKey = `idempotency:lock:${key}`;
  const resultKey = `idempotency:result:${key}`;

  // Step 1: Try to acquire lock (prevents race conditions)
  const acquired = await redis.set(lockKey, '1', 'EX', 30, 'NX');
  if (!acquired) {
    // Another request is processing this key
    // Wait and poll for result
    for (let i = 0; i < 50; i++) {
      const cached = await redis.get(resultKey);
      if (cached) return JSON.parse(cached);
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('Idempotency timeout');
  }

  try {
    // Step 2: Check if result already exists
    const cached = await redis.get(resultKey);
    if (cached) return JSON.parse(cached);

    // Step 3: Execute the operation
    const result = await fn();

    // Step 4: Store result
    await redis.setex(resultKey, IDEMPOTENCY_TTL, JSON.stringify(result));

    return result;
  } finally {
    // Step 5: Release lock
    await redis.del(lockKey);
  }
}
```

## Atomic Implementation with PostgreSQL

For stronger consistency, use the database:

```sql
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_idempotency_created_at ON idempotency_keys(created_at);
```

```typescript
async function withIdempotencyDB<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    // Try to insert the key first (fails if duplicate)
    await db.$executeRaw`
      INSERT INTO idempotency_keys (key, result)
      VALUES (${key}, '{}'::jsonb)
      ON CONFLICT (key) DO NOTHING
    `;

    // Check if it was already there
    const existing = await db.idempotencyKey.findUnique({ where: { key } });
    if (existing && Object.keys(existing.result).length > 0) {
      return existing.result as T;
    }

    // Execute
    const result = await fn();

    // Store result
    await db.idempotencyKey.update({
      where: { key },
      data: { result: result as any },
    });

    return result;
  } catch (error: any) {
    if (error.code === '23505') { // unique violation
      const existing = await db.idempotencyKey.findUnique({ where: { key } });
      if (existing) return existing.result as T;
    }
    throw error;
  }
}
```

## Idempotency Key Generation

```typescript
// Client-side generation (recommended)
const idempotencyKey = crypto.randomUUID();

// Or deterministic from request contents
function generateKey(userId: string, action: string, params: object): string {
  return crypto
    .createHash('sha256')
    .update(`${userId}:${action}:${JSON.stringify(params)}`)
    .digest('hex');
}
```

## Best Practices

| Practice | Rationale |
|---|---|
| **Key scope** | Include user ID + action + parameters to prevent cross-user collisions |
| **TTL** | 24 hours is standard; long enough for retries, short enough for key reuse |
| **Lock timeout** | 30 seconds prevents deadlocks if the handler crashes |
| **Return same response** | Same status code, headers, and body as the original |
| **Do not log keys** | Keys could leak sensitive operation identifiers |

## OWASP Reference

> "Implement idempotency keys for all state-changing operations that could be retried. Store keys with a TTL and validate them atomically." — OWASP API Security Cheat Sheet

> "A lack of idempotency in payment APIs is a critical vulnerability that can lead to financial loss and regulatory penalties." — OWASP Top 10 2021 — A04:2021-Insecure Design
