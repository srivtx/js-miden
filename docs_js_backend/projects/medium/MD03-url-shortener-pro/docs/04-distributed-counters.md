# MD03: Distributed Counters for Click Tracking

## The Counter Problem

Every redirect increments a click counter. At 100,000 redirects per second, a single database row (`UPDATE urls SET click_count = click_count + 1`) becomes a **hotspot**:
- Row-level lock contention
- Replication lag on read replicas
- Write amplification

## Strategy 1: Counter Sharding (Application-Level)

Instead of one counter, maintain `N` counter shards:

```sql
CREATE TABLE url_click_shards (
    url_id BIGINT NOT NULL,
    shard_id INT NOT NULL,
    click_count BIGINT DEFAULT 0,
    PRIMARY KEY (url_id, shard_id)
);

-- 10 shards per URL
INSERT INTO url_click_shards (url_id, shard_id)
SELECT id, generate_series(0, 9) FROM urls;
```

Increment a random shard:

```sql
-- In the redirect handler (no transaction needed!)
UPDATE url_click_shards
SET click_count = click_count + 1
WHERE url_id = 12345
  AND shard_id = random() % 10;
```

Read the total:

```sql
SELECT SUM(click_count) FROM url_click_shards WHERE url_id = 12345;
```

**Pros**: Scales linearly with shards. No single hotspot.
**Cons**: Read requires aggregation. Approximate if some shards lag.

## Strategy 2: Redis Counters with Periodic Flush

Use Redis `INCR` for real-time counting, flush to PostgreSQL periodically:

```javascript
// On every redirect
await redis.incr(`clicks:${shortCode}`);

// Background worker runs every minute
const codes = await redis.keys('clicks:*');
for (const key of codes) {
    const count = await redis.getset(key, 0); // Atomically read and reset
    const shortCode = key.replace('clicks:', '');
    await db.query(
        'UPDATE urls SET click_count = click_count + $1 WHERE short_code = $2',
        [count, shortCode]
    );
}
```

**Pros**: Extremely fast writes (`O(1)` in Redis). Batched DB updates.
**Cons**: Potential data loss if Redis crashes between flushes. Use Redis AOF persistence.

## Strategy 3: HyperLogLog for Cardinality

If the goal is "how many **unique** visitors?" rather than "how many clicks?", use **HyperLogLog**:

```javascript
// Each redirect adds the visitor's IP (or user ID) to the HLL
await redis.pfadd(`unique:${shortCode}`, visitorId);

// Get approximate unique count
const uniqueVisitors = await redis.pfcount(`unique:${shortCode}`);
```

HyperLogLog uses ~12KB of memory regardless of the number of elements, with a **2% standard error**.

This is how **Redis** and **ClickHouse** estimate unique counts at scale.

## Strategy 4: Kafka + Stream Processing

For enterprise-grade analytics, decouple click counting from the redirect path:

```
Redirect Server → Kafka Topic (clicks) → Flink/Spark → ClickHouse
```

```javascript
// In the redirect handler (fire-and-forget)
kafka.producer.send({
    topic: 'clicks',
    messages: [{
        key: shortCode,
        value: JSON.stringify({
            shortCode,
            timestamp: Date.now(),
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            referrer: req.headers.referer
        })
    }]
});

// Consumer aggregates into ClickHouse
```

**Pros**: Redirect server does zero DB writes. Analytics pipeline is independent.
**Cons**: Infrastructure complexity. Eventual consistency (counts lag by seconds).

## Comparing Counter Strategies

| Strategy | Write Speed | Read Speed | Accuracy | Complexity |
|----------|------------|-----------|----------|------------|
| Single DB Row | Very Slow | Fast | Exact | Low |
| DB Shards | Fast | Medium | Exact | Medium |
| Redis + Flush | Very Fast | Fast | Near-exact | Medium |
| HyperLogLog | Very Fast | Fast | ~98% | Low |
| Kafka + ClickHouse | Very Fast | Fast | Exact | High |

## CAP Theorem Consideration

Counters are the classic example where **eventual consistency** is acceptable:
- A user seeing `1,234` clicks instead of `1,235` for 30 seconds is harmless.
- Therefore, we choose **AP** for counters, using Redis or Kafka.

However, if clicks trigger billing (e.g., pay-per-click advertising), **strong consistency** is required, and the system must use **CP** counter updates with ACID guarantees.

## Key Insight

> "At scale, counting is harder than it looks. The naive `UPDATE ... SET count = count + 1` is a distributed systems anti-pattern." — High Scalability Blog

For this project, we recommend **Redis counters with periodic PostgreSQL flush** for simplicity, graduating to **Kafka + ClickHouse** if analytics depth is required.
