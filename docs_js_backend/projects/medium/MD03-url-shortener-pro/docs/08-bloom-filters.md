# MD03: Bloom Filters — Probabilistic Existence Checks

## The Problem: Fast Existence Checks

When generating a new short code, we must ensure it doesn't already exist. Two options:
1. **Query PostgreSQL**: Accurate, but slow (~5-10ms) and loads the DB.
2. **Query Redis**: Faster (~1ms), but still a network roundtrip.

For high-throughput code generation, even 1ms is too slow. We need **sub-microsecond** existence checks.

Enter the **Bloom Filter**.

## What is a Bloom Filter?

A Bloom filter is a **space-efficient probabilistic data structure** that answers:
> "Have I seen this element before?"

It can return:
- **Definitely NO** (element was never inserted)
- **Probably YES** (element may have been inserted, with a small false positive probability)

It **never** returns a false negative.

## How It Works

```
Structure: A bit array of size m, initially all 0s.
           k independent hash functions.

Insert "abc123":
  h1("abc123") % m → set bit 3
  h2("abc123") % m → set bit 7
  h3("abc123") % m → set bit 12

Check "abc123":
  h1("abc123") % m → bit 3 = 1?
  h2("abc123") % m → bit 7 = 1?
  h3("abc123") % m → bit 12 = 1?
  All 1s? → "Probably YES"
  Any 0?  → "Definitely NO"

Check "xyz789" (never inserted):
  h1("xyz789") % m → bit 3 = 1 (collision!)
  h2("xyz789") % m → bit 19 = 0
  Any 0? → "Definitely NO" ✓
```

## Mathematical Foundations

**Burton H. Bloom (1970)**, "Space/Time Trade-offs in Hash Coding with Allowable Errors":

Given:
- `m` = number of bits in the filter
- `n` = number of elements inserted
- `k` = number of hash functions

False positive probability:

```
p ≈ (1 - e^(-kn/m))^k
```

Optimal number of hash functions:

```
k = (m/n) × ln(2)
```

### Example Calculation

For a URL shortener expecting 1 billion codes, with a 1% false positive rate:

```
n = 1,000,000,000
p = 0.01

m = - (n × ln(p)) / (ln(2)²)
  = - (1e9 × ln(0.01)) / 0.48045
  ≈ 9.6 billion bits
  ≈ 1.2 GB

k = (m/n) × ln(2)
  = (9.6e9 / 1e9) × 0.693
  ≈ 6.6 → 7 hash functions
```

**1.2 GB of RAM** can tell us with 99% accuracy whether a code exists, without ever querying the database.

## Redis Bloom Filter

Redis provides Bloom filters via the **RedisBloom** module:

```bash
# Add element
BF.ADD url_filter "abc123"

# Check existence
BF.EXISTS url_filter "abc123"  # Returns 1 (probably yes)
BF.EXISTS url_filter "newcode" # Returns 0 (definitely no)
```

```javascript
const redis = require('redis');

async function generateUniqueCode() {
    let attempts = 0;
    while (attempts < 10) {
        const code = generateRandomCode();

        // Bloom filter check (fast)
        const probablyExists = await redis.bf.exists('url_filter', code);
        if (!probablyExists) {
            // Definitely doesn't exist. Safe to use (but still check DB for certainty)
            return code;
        }

        // Probably exists. Check DB to be sure.
        const dbExists = await db.query('SELECT 1 FROM urls WHERE short_code = $1', [code]);
        if (dbExists.rows.length === 0) {
            // False positive! Code is actually free.
            return code;
        }

        attempts++;
    }
    throw new Error('Failed to generate unique code');
}
```

## Bloom Filter in the URL Shortener Architecture

```
┌──────────────┐
│ Generate Code│
└──────┬───────┘
       │
       ▼
┌──────────────┐     NO      ┌──────────────┐
│ Bloom Filter │────────────►│ Return Code  │
│   .exists?   │             │ (definitely  │
└──────┬───────┘             │  unique)     │
       │ YES                 └──────────────┘
       ▼
┌──────────────┐     NO      ┌──────────────┐
│ Query DB     │────────────►│ Return Code  │
│ (confirm)    │             │ (false pos)  │
└──────┬───────┘             └──────────────┘
       │ YES
       ▼
┌──────────────┐
│ Generate New │
│ Code & Retry │
└──────────────┘
```

## Counting Bloom Filters

Standard Bloom filters don't support deletion. **Counting Bloom Filters** use counters instead of bits:

```
Insert: increment counter at each hash position
Delete: decrement counter at each hash position
Check: all counters > 0?
```

This allows removal of expired URLs, keeping the filter fresh.

## Alternatives: Cuckoo Filters

**Cuckoo Filters** (Fan et al., 2014) improve upon Bloom filters:
- Support deletion natively
- Lower false positive rates for the same space
- Can return the inserted item (not just yes/no)

However, they are more complex to implement and not as widely supported in Redis modules.

## CAP Theorem Consideration

A Bloom filter is an **AP** data structure:
- It is inherently approximate (false positives).
- It does not require consistency across nodes; each node can maintain its own filter, rebuilt periodically from the database.
- During a partition, a node with a stale filter may generate codes that exist on another partition (caught by DB uniqueness constraint).

## Key Insight

> "A Bloom filter gives you the right to skip an expensive operation. When it says 'no', you save a database query. When it says 'maybe', you pay the query cost. The savings dominate." — Probabilistic Data Structures for Web Analytics

For a URL shortener generating millions of codes, the Bloom filter transforms existence checking from an `O(1)` network operation into an `O(k)` memory operation, where `k` (number of hashes) is typically 3-7.

## Reference

- **Bloom, B.H.** (1970). "Space/Time Trade-offs in Hash Coding with Allowable Errors". CACM.
- **Broder, A. & Mitzenmacher, M.** (2004). "Network Applications of Bloom Filters: A Survey". Internet Mathematics.
- **Fan, B. et al.** (2014). "Cuckoo Filter: Practically Better Than Bloom". ACM CoNEXT.
