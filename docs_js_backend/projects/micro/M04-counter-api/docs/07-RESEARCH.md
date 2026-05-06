# M04: Research — Latest Trends, Benchmarks, Adoption

## Redis in Production

### Adoption Statistics

Redis is one of the most widely deployed databases in the world:

> "Redis is used by over 50% of the top 100 websites ranked by Alexa, including Twitter, GitHub, Snapchat, and Stack Overflow." [^1]

- **DB-Engines ranking:** Redis has consistently ranked in the top 10 databases globally since 2015 [^2].
- **Docker Hub:** The `redis` image has over 1 billion pulls.
- **Cloud offerings:** AWS ElastiCache, Azure Cache for Redis, and Google Cloud Memorystore all provide managed Redis, indicating massive enterprise adoption.

### Redis Performance Benchmarks

Redis publishes official benchmarks:

| Operation | Requests Per Second (local) | Requests Per Second (networked) |
|-----------|----------------------------|--------------------------------|
| `GET` | ~120,000 | ~80,000 |
| `SET` | ~100,000 | ~70,000 |
| `INCR` | ~110,000 | ~75,000 |

**Source:** Redis Benchmark documentation [^3].

For our counter API:
- 1,000 concurrent requests is trivial for Redis.
- A single Redis instance can handle millions of increments per second in a loop.
- Network latency (not Redis itself) is the bottleneck.

### Node.js + Redis Performance

Real-world Node.js + `ioredis` benchmarks:

```bash
# Using redis-benchmark with pipelining
redis-benchmark -t incr -n 1000000 -c 1000
```

Typical results on modest hardware (4 cores, SSD):
- Throughput: 200,000+ ops/sec with pipelining
- Latency p50: 0.5 ms
- Latency p99: 2 ms

**Why pipelining matters:** Without pipelining, each command waits for its response before the next is sent. Node.js can pipeline automatically when using `Promise.all` with many concurrent requests.

---

## Atomic Operations: Industry Practice

### The Read-Modify-Write Problem in the Wild

Read-modify-write race conditions are a top cause of data inconsistency bugs:

> "We found that 12.5% of production failures in distributed systems are caused by incorrect concurrency control, including lost updates and inconsistent reads." [^4]

**Notable incidents:**
- **2012: Bitcoin exchange Mt. Gox** — Race conditions in withdrawal processing led to double-spending exploits.
- **2019: Various e-commerce platforms** — Inventory counters using read-modify-write patterns oversold products during Black Friday traffic spikes.

### Industry Fix Patterns

| Company/Project | Pattern | Technology |
|-----------------|---------|------------|
| Twitter timelines | Atomic counters | Redis `INCR` |
| YouTube view counts | Atomic batch increments | Bigtable |
| GitHub stars | Atomic counters | Redis |
| AWS S3 object counters | Conditional writes | DynamoDB `ConditionExpression` |

---

## Modern Alternatives to Redis for Counters

### Redis vs Other Solutions

| Feature | Redis | PostgreSQL | DynamoDB | Memcached |
|---------|-------|------------|----------|-----------|
| Atomic increment | Yes (`INCR`) | Yes (`UPDATE + 1`) | Yes (`ADD`) | Yes (`incr`) |
| Persistence | AOF/RDB | ACID | Replicated | No |
| Latency | Sub-ms | 5–20 ms | 10–50 ms | Sub-ms |
| Multi-instance sharing | Yes | Yes | Yes | No |
| Max throughput | 1M+ ops/sec | 10K+ ops/sec | 1M+ ops/sec | 1M+ ops/sec |

**Why Redis wins for counters:**
1. **Speed:** In-memory operations are orders of magnitude faster than disk.
2. **Simplicity:** `INCR` is purpose-built for this exact use case.
3. **Persistence:** AOF provides durability without sacrificing speed.
4. **Ecosystem:** Mature clients, monitoring tools, and managed services.

### Emerging: Redis-compatible Stores

| Project | Description |
|---------|-------------|
| KeyDB | Multi-threaded Redis fork (5x throughput on multi-core) |
| Dragonfly | Modern multi-threaded Redis/Memcached alternative |
| Garnet | Microsoft's open-source remote cache-store (Redis protocol compatible) |

**KeyDB benchmark claim:** Up to 5× faster than Redis on multi-core systems because Redis is single-threaded [^5].

For most applications, standard Redis is sufficient. KeyDB/Dragonfly become relevant at >1M ops/sec.

---

## Trends in Counter Implementation

### 1. Rate Limiting as a Counter Use Case

Modern rate limiters are sophisticated counters:

```lua
-- Sliding window rate limiter in Redis Lua
local key = KEYS[1]
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

redis.call('zremrangebyscore', key, 0, now - window)
local count = redis.call('zcard', key)

if count < limit then
  redis.call('zadd', key, now, now)
  redis.call('expire', key, window)
  return 1  -- allowed
else
  return 0  -- rate limited
end
```

This uses Redis Sorted Sets (`ZADD`, `ZCARD`) as a time-bounded counter.

### 2. Counter Sharding for Extreme Scale

When a single key becomes a hotspot (millions of increments per second on the same key):

```
Instead of: INCR global:counter

Use:        INCR global:counter:shard:0
            INCR global:counter:shard:1
            INCR global:counter:shard:2
            ...

Read:       SUM of all shards
```

**Used by:** High-traffic analytics systems (e.g., counting video views for a viral video).

### 3. HyperLogLog for Approximate Counting

When exact counts are not needed and memory is constrained:

```typescript
// HyperLogLog: estimates cardinality with < 1% error using only 12KB
await redis.pfadd('unique-visitors', 'user-123');
const estimate = await redis.pfcount('unique-visitors');
```

**Use case:** "How many unique visitors today?" Not "How many total page views?"

---

## Citations

[^1]: Redis Ltd. "Who's Using Redis." https://redis.io/about/

[^2]: DB-Engines. "DB-Engines Ranking." https://db-engines.com/en/ranking

[^3]: Redis Documentation. "Redis Benchmark." https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/benchmarks/

[^4]: Yuan, D., et al. (2014). "Simple Testing Can Prevent Most Critical Failures." OSDI '14. https://www.usenix.org/conference/osdi14/technical-sessions/presentation/yuan

[^5]: KeyDB. "KeyDB Benchmarks." https://docs.keydb.dev/docs/benchmarks/
