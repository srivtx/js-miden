# MD03: Hash Collisions and Uniqueness Guarantees

## The Birthday Problem

A hash collision occurs when two different inputs produce the same output. In URL shorteners, this means two different long URLs map to the same short code.

The **Birthday Problem** tells us how many codes we can generate before collision becomes likely:

> In a space of `N` possible codes, the probability of at least one collision among `k` randomly chosen codes exceeds 50% when `k ≈ 1.177 × √N`.

For 6-character Base62 (`N = 62⁶ ≈ 56.8 billion`):
- 50% collision probability at `k ≈ 1.177 × √56.8B ≈ 280,000` codes.

This means with just **280,000** random 6-character codes, you have a coin-flip chance of a collision. This is unacceptable.

## Strategies for Collision Avoidance

### Strategy 1: Database Uniqueness Constraint

The simplest and most robust approach:

```sql
CREATE TABLE urls (
    short_code VARCHAR(20) PRIMARY KEY,
    long_url TEXT NOT NULL
);
```

If a collision occurs, the `INSERT` fails. The application retries with a new code.

```javascript
async function createShortUrl(longUrl, maxRetries = 5) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const code = generateRandomCode();
        try {
            await db.query(
                'INSERT INTO urls (short_code, long_url) VALUES ($1, $2)',
                [code, longUrl]
            );
            return code;
        } catch (err) {
            if (err.code === '23505') { // unique_violation
                continue; // Retry with new code
            }
            throw err;
        }
    }
    throw new Error('Failed to generate unique code after max retries');
}
```

**Pros**: 100% correctness. Simple.
**Cons**: Retry latency on collision. Contention on the index under high write load.

### Strategy 2: Pre-Generated Code Pools

Generate a large pool of unique codes in advance:

```sql
CREATE TABLE code_pool (
    short_code VARCHAR(20) PRIMARY KEY,
    used BOOLEAN DEFAULT FALSE
);

-- Pre-populate with millions of codes
-- Application claims codes atomically:
UPDATE code_pool
SET used = TRUE
WHERE short_code = (
    SELECT short_code FROM code_pool
    WHERE used = FALSE
    ORDER BY RANDOM()
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
RETURNING short_code;
```

**Pros**: No collision at insert time. Fast claim.
**Cons**: Requires pre-generation. Wastes codes if never used.

### Strategy 3: Cryptographic Hash + Truncation

Hash the long URL and encode a portion:

```javascript
const crypto = require('crypto');

function hashToCode(longUrl, length = 6) {
    const hash = crypto.createHash('sha256').update(longUrl).digest();
    // Take first 4 bytes (32 bits), encode in Base62
    const num = hash.readUInt32BE(0);
    return encodeBase62(num).padStart(length, '0').slice(0, length);
}
```

**Problem**: Deterministic. The same URL always produces the same code. If two users shorten `https://google.com`, they get the same short link. This may or may not be desired.

**Collision Risk**: With 32 bits and 6 Base62 chars, we have `62⁶ ≈ 56B` possible codes but only `2³² ≈ 4.3B` hash outputs. Collision probability is significant at scale.

### Strategy 4: Counter-Based (No Collisions)

Use a monotonically increasing counter:

```sql
CREATE SEQUENCE url_id_seq START 1000000000;

-- Generate code
SELECT encodeBase62(nextval('url_id_seq'));
```

**Pros**: Zero collisions. Deterministic length growth.
**Cons**: Predictable. Requires a single counter source (or distributed counter).

## Collision Probability Table

| Code Length | Space Size | Codes Before 50% Collision Risk | Codes Before 1% Risk |
|-------------|-----------|--------------------------------|---------------------|
| 5 | 916M | 35,000 | 4,300 |
| 6 | 56.8B | 280,000 | 34,000 |
| 7 | 3.52T | 7,000,000 | 860,000 |
| 8 | 218T | 55,000,000 | 6,700,000 |

Conclusion: For any serious shortener, use **7+ characters** or a **counter-based** scheme.

## Handling Collisions in Practice

### bit.ly's Approach (Inferred)

bit.ly likely uses a combination of:
1. **Counter-based generation** for guaranteed uniqueness
2. **Hash-based custom aliases** for user-defined codes
3. **Database uniqueness constraint** as the ultimate arbiter

### Twitter's t.co

t.co uses a **sequential counter** because:
- Every tweet ID is already unique (Snowflake)
- The short code is derived from the tweet's internal ID
- No collision possible by design

## Distributed Collision Avoidance

In a multi-node system, two servers might generate the same random code simultaneously:

```
Server A: Generate code "abc123" → Check DB → Not found → [NETWORK DELAY]
Server B: Generate code "abc123" → Check DB → Not found → Insert "abc123"
Server A: Insert "abc123" → FAILS (unique_violation)
```

**Solution**: The database uniqueness constraint is the **source of truth**. Application-level checks are only optimizations. Always handle `unique_violation`.

## Key Insight

> "In a URL shortener, collisions are not an edge case. They are a statistical certainty at scale. The system must be designed to detect and recover from them gracefully, with the database constraint as the final line of defense." — Distributed Systems Design

There are no safe shortcuts. A uniqueness constraint on `short_code` is non-negotiable.
