# 02-DECISIONS.md

## Decision 1: Data Structure

**Chosen:** In-memory `ScoreEntry[]` array.

**Alternatives:**
- **Redis Sorted Set (ZADD/ZREVRANGE)**: O(log n) for both insert and range query. Industry standard for leaderboards. Adds Redis dependency.
- **PostgreSQL with composite index**: `CREATE INDEX idx_scores ON scores(period, score DESC)`. Durable, transactional, supports complex analytics. Slower than Redis.
- **MongoDB with sorted index**: Similar to Postgres. Document model fits flexible metadata.

**Why array:** Demonstrates the O(n) scan problem clearly. The fix (Redis Sorted Sets) is a direct drop-in replacement.

---

## Decision 2: Period Filtering

**Chosen:** Timestamp comparison in JavaScript (`getStartOfDay`, `getStartOfWeek`).

**Alternatives:**
- **Database-native time ranges**: `WHERE timestamp >= date_trunc('day', now())`. Uses database indexes efficiently.
- **Separate Redis keys per period**: `leaderboard:daily:2024-01-15`, `leaderboard:weekly:2024-W03`. Simplifies queries but requires cron jobs to create new keys.
- **TTL-based expiration**: Redis key with TTL for daily leaderboards. Auto-cleans old data.

**Why JS filtering:** Shows the full-table scan problem. In production, period filtering should happen at the storage layer with indexes.

---

## Decision 3: Score Update Strategy

**Chosen:** Unconditional overwrite (the bug).

**Alternatives:**
- **Compare-and-swap**: Read existing score, only update if new > old. Still has a race window between read and write.
- **Atomic conditional update**: Redis `ZADD leaderboard GT score member` (Redis 6.2+). True atomicity.
- **Database UPSERT**: `INSERT ... ON CONFLICT DO UPDATE SET score = GREATEST(scores.score, EXCLUDED.score)`. Database-level atomicity.

**Why unconditional overwrite:** Makes the race condition bug obvious and easy to fix. Correct strategies are shown in docs.

---

## Decision 4: Rank Calculation

**Chosen:** Computed dynamically on read (`index + 1`).

**Alternatives:**
- **Stored rank field**: Update everyone's rank after every submission. O(n) writes, O(1) reads. Terrible for write throughput.
- **Redis ZRANK**: O(log n) rank lookup per player. Perfect for "what's my rank?" queries.
- **Approximate rank (t-digest)**: Statistical approximation for massive datasets. Sacrifices exactness for speed.

**Why dynamic**: Simple and correct for small datasets. Redis `ZRANK` is the production solution.

---

## Decision 5: Language / Runtime

**Chosen:** TypeScript + Node.js.

**Alternatives:**
- **Go**: Excellent for high-throughput game servers. Native concurrency.
- **Python + FastAPI**: Simple syntax. GIL limits concurrency but fine for I/O-bound work.
- **C++ / Rust**: Required for AAA game backends with 10M+ concurrent players.

**Why Node.js:** Express is familiar. The performance bug (full scan) is visible with the built-in `perf_hooks` module.
