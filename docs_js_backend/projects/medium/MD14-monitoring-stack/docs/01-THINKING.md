# Thinking Process

## Mental Models

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Application │────▶│  Metrics API    │────▶│  Time-Series    │
│   Code      │     │  (/metrics)     │     │  In-Memory DB   │
└─────────────┘     └─────────────────┘     └─────────────────┘
                                                     │
                                                     ▼
                                              ┌─────────────────┐
                                              │  Alert Engine   │
                                              │  (thresholds)   │
                                              └─────────────────┘
                                                     │
                                                     ▼
                                              ┌─────────────────┐
                                              │  Pager / Slack  │
                                              └─────────────────┘
```

## The Hot Path
The most frequent operation is `recordMetric()`. It must be O(1) and lock-free (or low-contention). Every millisecond spent here is a millisecond stolen from the application.

## The Danger Zone
1. **Cardinality Explosion**: A single developer adds `userId` to a counter label. Suddenly 1M users = 1M time series. OOM.
2. **Retention**: Forgot to prune. Memory grows linearly. Node crashes on day 7.
3. **Flapping**: Threshold at 80%. CPU oscillates between 79% and 81%. Pager fires 50 times/hour.

## Question Everything
- Do we need a database? No — in-memory is fine for this scale, with disk persistence optional.
- Do we need Redis? Maybe for distributed alerting, but not for single-node metrics.
- Do we need auth? Yes, eventually. Not in Phase 1.
- Do we need real-time? Alerts should evaluate within seconds, not milliseconds.

## The "What If" Game
- What if 1000 services report metrics simultaneously? Map contention. Need sharded maps.
- What if the database is down? We buffer in memory and drop oldest.
- What if a user sends a histogram with 10M buckets? Validate max buckets.
- What if two alerts fire for the same condition? Deduplicate by rule fingerprint.
