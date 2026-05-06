# Critic Review

## Technical Review
A senior engineer would say:
- "No message queue between ingestion and aggregation. If Redis is down, events are ingested but not counted. Use a queue with retry."
- "The sliding window implementation sorts all events in memory. At 1M events, that's a 500MB array. Use a ring buffer or streaming algorithm."
- "No backpressure. If Redis is slow, the HTTP handler blocks. Use `bull` or `sqs` for async processing."
- "Missing histogram support. A counter of 'request latency' is useless without bucketed distributions."

## Security Review
- **Denial of Service**: The ingestion endpoint accepts arbitrary event types. An attacker can create millions of unique event types, causing Redis key explosion.
- **Data Injection**: No validation on `payload` structure beyond `z.record(z.unknown())`. Malformed payloads can break downstream consumers.
- **No Rate Limiting**: A single client can POST 10K events/second, saturating PostgreSQL and Redis.

## Educational Review
- **What's missing**: Exactly-once semantics, watermarking, and late-event handling. In real stream processing, events can arrive out of order.
- **What's confusing**: The difference between event time (when the event happened) and processing time (when the server received it) isn't documented.
- **Suggested addition**: A diagram showing how tumbling windows handle events at the boundary (00:59 vs 01:01).

## Fixes Applied
- Added `processEventAtomically()` using Redis `INCR` and `INCRBYFLOAT`.
- Added `cleanupOldWindows()` placeholder with TTL-based deletion strategy.
- Added `AggregationEngine.calculateSlidingWindow()` for trend analysis.
