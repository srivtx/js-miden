# S11 Notification Service — Architecture

## Decision: SSE vs. WebSockets vs. Long Polling

### Alternative 1: Server-Sent Events (SSE) — Current
- **Pros**: Native browser `EventSource`, automatic reconnection, simple one-way server→client protocol, works over HTTP.
- **Cons**: One-way only (client actions need separate HTTP calls), limited to 6 concurrent connections per domain on HTTP/1.1.
- **Verdict**: Perfect for notification counts where the server pushes updates and the client occasionally sends actions.

### Alternative 2: WebSockets (Socket.io)
- **Pros**: True bidirectional, lower latency after handshake, instant push without polling intervals.
- **Cons**: Heavier protocol, harder to scale horizontally, proxy/firewall issues.
- **Verdict**: Better for chat or collaborative apps where sub-second latency is critical.

### Alternative 3: Long Polling
- **Pros**: Works everywhere, no special client needed.
- **Cons**: High overhead, connection cycling drains battery, latency bounded by polling interval.
- **Verdict**: Obsolete for this use case; only justified for maximum legacy compatibility.

## Decision: SQLite vs. Redis

### Alternative 1: SQLite (Current)
- **Pros**: ACID compliance, no external service, durable storage, simple setup.
- **Cons**: File-level locking serializes writes; write throughput limited to ~1,000 TPS.
- **Verdict**: Sufficient for an MVP or small-scale app.

### Alternative 2: Redis
- **Pros**: `LPUSH`/`LRANGE` for notification lists, `INCR`/`DECR` for atomic counters, pub/sub for instant SSE fan-out.
- **Cons**: Not durable by default (AOF/RDB required), requires running Redis.
- **Verdict**: The industry standard for notification systems at scale (Slack, Discord).

### Alternative 3: PostgreSQL
- **Pros**: Full SQL power, JSONB for flexible notification payloads, excellent for complex queries.
- **Cons**: More setup than SQLite, still slower than Redis for simple counters.
- **Verdict**: The right choice when you need complex filtering, search, or joins with user data.

## Decision: Counter Table vs. COUNT(*)

### Alternative 1: Dedicated Counter (Current)
A `users` table with `unread_count` column.
- **Pros**: O(1) read for SSE payload generation.
- **Cons**: Must be kept in sync with notifications table; risks inconsistency due to race conditions.
- **Verdict**: Fast but fragile.

### Alternative 2: Dynamic COUNT(*)
```sql
SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read = 0;
```
- **Pros**: Always accurate, single source of truth.
- **Cons**: O(n) scan; slows down as notification volume grows.
- **Verdict**: Best for small volumes or strict accuracy requirements.

### Alternative 3: Materialized View / Cache
Compute the count periodically or cache it in Redis with TTL.
- **Pros**: Balances speed and accuracy.
- **Cons**: Stale data possible; invalidation complexity.
- **Verdict**: Best for high-read, moderate-write workloads.

## Decision: Notification Aggregation

### Alternative 1: One Row Per Event (Current)
Every like, comment, or follow creates a distinct notification row.
- **Pros**: Simple, accurate audit trail.
- **Cons**: A popular post could generate 10,000 rows; noisy for users.

### Alternative 2: Aggregation Table
```sql
CREATE TABLE notification_aggregations (
  user_id TEXT,
  type TEXT,
  reference_id TEXT,
  count INTEGER,
  latest_actor TEXT,
  last_at INTEGER,
  UNIQUE(user_id, type, reference_id)
);
```
- **Pros**: "Alice and 4 others liked your post" in a single row.
- **Cons**: More complex read path; requires merging aggregated and non-aggregated notifications.
- **Verdict**: Essential for social networks (Facebook, Instagram, LinkedIn).
