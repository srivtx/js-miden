# 06-testing.md

## Running Tests

```bash
npm test
```

Uses Node.js built-in test runner with supertest.

## Test Coverage

- **Score submission** — stores score with metadata
- **Leaderboard query** — returns sorted top N
- **Performance** — 1000 entries should query in < 50ms
- **Race condition** — higher score preserved on duplicate submission

## Failing Tests

Two tests intentionally fail due to Phase 1 bugs:

1. `should use indexed score lookup for top 100` — full array scan on every query
2. `should not overwrite higher score with lower score` — unconditional overwrite

## Fixing

1. Use Redis Sorted Sets (`ZADD`, `ZREVRANGE`) for O(log n) rank queries
2. Check existing score before update: only overwrite if `newScore > oldScore`
3. Add database index on `(period, score DESC)`
