# Thinking Process

## Mental Models

```
┌──────────────┐
│ Event Sources │  (Web apps, mobile, IoT)
└──────┬───────┘
       │ POST /events
       ▼
┌─────────────────────┐
│  Ingestion API      │
│  - Validation (Zod) │
│  - Batch support    │
└────────┬────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐  ┌────────┐
│PostgreSQL│ │ Redis  │
│ (events) │ │(aggregates)│
└───────┘  └────────┘
         │
         ▼
┌─────────────────────┐
│  Aggregation Engine │
│  - Tumbling windows │
│  - Sliding windows  │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Dashboard API      │
│  GET /metrics       │
│  GET /metrics/timeseries
└─────────────────────┘
```

## The Hot Path
`POST /events` is the hot path. Every millisecond here is stolen from the application. The critical section is:
1. Validate JSON (Zod).
2. Persist to PostgreSQL (durability).
3. Update Redis counters (aggregation).

Steps 2 and 3 must be fast. Step 3 is where our race-condition bug lives.

## The Danger Zone
1. **Race Condition in Aggregation**: Two events arrive simultaneously. Both read count=5, both write count=6. One update is lost. At 1K events/second, this is guaranteed.
2. **No Window Cleanup**: Every minute generates a new window key. Redis keys grow linearly. After 30 days, you have 43K keys per metric. Memory exhaustion.
3. **Backpressure**: If Redis is slow, the ingestion API blocks. Events queue in memory. Node.js heap explodes.

## Question Everything
- Do we need exactly-once event processing? No — at-least-once is fine if aggregation is idempotent (Redis INCR is idempotent).
- Do we need a message queue (Kafka)? For learning, no. For production with multiple consumers, yes.
- Do we store raw events forever? No — raw events have a TTL. Rollups are the long-term storage.
- Do we need sliding windows? Yes — tumbling windows miss events at boundaries. Sliding windows smooth the curve.

## The "What If" Game
- What if 10K events arrive in 1 second? PostgreSQL `createMany` batches. Redis pipeline batches. Should be fine.
- What if the aggregation window is 1ms? Too many keys. Redis chokes on key cardinality.
- What if a consumer reads mid-aggregation? The read model sees partial data. Acceptable for real-time; not for billing.
