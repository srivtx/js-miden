# MD12 Realtime Analytics — v7 Production Setup

## Overview
The final step transforms the basic ingestion service into a real-time analytics platform. We introduce Redis for O(1) atomic aggregations, tumbling and sliding windows, TTL-based retention, and cardinality guardrails.

## Changes
- **Redis Aggregation**: `redis.incr()` for counters, `redis.incrbyfloat()` for sums. Replaces the racy GET-SET pattern.
- **Windowing**:
  - Tumbling windows (1-minute default) for dashboards.
  - Sliding windows (overlapping) for trend analysis.
- **Retention**: `redis.expire(key, ttl)` on every write + background pruning job.
- **Cardinality Limits**: Hard cap on unique label combinations per metric (prevents OOM).
- **Dashboard API**: `GET /metrics`, `GET /metrics/timeseries`, `GET /metrics/rates`.
- **Deployment**: `docker-compose.yml` with PostgreSQL + Redis.

## Code Snippet
```typescript
// src/api/ingestion.ts (production excerpt)
async function processEventAtomically(event) {
  const counterKey = `counter:${event.eventType}:${windowKey}`;
  await redis.incr(counterKey);               // atomic
  await redis.expire(counterKey, 86400);      // 24h TTL

  if (typeof event.payload.value === 'number') {
    await redis.incrbyfloat(`sum:${event.eventType}:${windowKey}`, event.payload.value);
  }
}
```

## Rationale
- Atomic Redis ops eliminate race conditions under concurrent ingestion.
- TTL ensures bounded memory growth; without it, keys grow linearly forever.
- Sliding windows smooth boundary artifacts that tumbling windows miss.

## Trade-offs
- In-memory Redis is not durable; for production, use Redis AOF or a replicated cluster.
- No message queue between ingestion and aggregation yet; if Redis is down, events are ingested but not counted.

## References
- `docs/02-DECISIONS.md` — why Redis + PostgreSQL.
- `docs/06-BUGS.md` — race condition and missing window cleanup bugs.
- `docs/03-CONCEPTS.md` — cardinality danger explained.
