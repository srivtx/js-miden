# 08-CRITIQUE.md

## What Works

1. **Period support**: Daily, weekly, and all-time filters are essential for engagement and are correctly modeled.
2. **Rank computation**: Dynamic rank calculation (`index + 1`) is simple and correct for small datasets.
3. **Test design**: The performance test (top-100 query on 5K entries should be < 0.1ms) and the race condition test are both excellent failure detectors.
4. **Type safety**: TypeScript interfaces for `ScoreEntry` and `LeaderboardEntry` prevent common data shape bugs.

## What Doesn't Work

1. **Unconditional overwrite**: The most damaging bug. Lower scores replacing higher scores is user-facing data corruption.
2. **Full table scan**: O(n log n) on every read is a scalability killer. This pattern fails every production load test.
3. **No deduplication**: Multiple entries per player per period create duplicate ranks and confusing UI.
4. **In-memory storage**: Data lost on restart. No persistence for competitive events.
5. **No pagination**: Returns unbounded result sets. A million-player game would return a 50MB JSON response.

## What Could Be Better

1. **Redis Sorted Sets from day one**: The array is a deliberate teaching tool, but a Redis implementation would be just as instructive and actually scalable.
2. **Atomic operations**: Use Redis `ZADD ... GT` or database `ON CONFLICT` to eliminate race conditions entirely.
3. **Caching layer**: Cache the top 100 for 10-30 seconds. 99% of leaderboard reads hit the same top players.
4. **Approximate leaderboards**: For truly massive datasets (10M+ players), use t-digest or HyperLogLog for approximate rank queries.
5. **Event sourcing**: Store every score submission as an event. Rebuild leaderboards from the event log for auditability and replay.

## Honest Assessment

This project perfectly illustrates the gap between "it sorts correctly in a unit test" and "it serves 10,000 concurrent users." The array-based approach is a classic trap: it works beautifully for 10 entries, then catastrophically fails at 10,000.

The race condition is particularly insidious because it is probabilistic. During low traffic, scores arrive sequentially and everything looks fine. During a tournament or viral event, concurrent submissions expose the bug and corrupt the entire leaderboard.

**Grade: A- as a teaching tool. F as production code.**

## ASCII: Maturity Ladder

```
Level 5: Global sharding, approximate ranks, ML-based anti-cheat, real-time streaming
   |
Level 4: Redis Cluster, event sourcing, analytics pipeline, cheat detection
   |
Level 3: Redis Sorted Sets, atomic updates, caching, pagination
   |
Level 2: Database index, conditional updates, basic caching
   |
Level 1: In-memory array, full scan, unconditional overwrite  <-- YOU ARE HERE
   |
Level 0: No leaderboard, CSV export for rankings  <-- STARTING POINT
```
