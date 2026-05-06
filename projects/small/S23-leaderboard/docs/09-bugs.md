# 09-bugs.md

## Bug 1: Full Table Scan

**Location:** `src/service.ts` in `getLeaderboard()`

**Issue:** Every leaderboard query filters and sorts the entire score array. With 1M+ entries this is O(n) and degrades linearly.

**Impact:**
- Slow leaderboard loads
- High CPU on every page view
- Database/memory pressure

**Fix:**
```typescript
// Redis Sorted Set
await redis.zadd(`leaderboard:${period}`, score, userId);
const top = await redis.zrevrange(`leaderboard:${period}`, 0, 99, 'WITHSCORES');

// Or database index
CREATE INDEX idx_leaderboard ON scores(period, score DESC);
SELECT * FROM scores WHERE period = 'daily' ORDER BY score DESC LIMIT 100;
```

## Bug 2: Race Condition in Score Update

**Location:** `src/service.ts` in `submitScore()`

**Issue:** Two concurrent submissions for the same user overwrite each other. The second write wins regardless of score value, so a lower score can replace a higher one.

**Impact:**
- Incorrect rankings
- Player frustration
- Data integrity issues

**Fix:**
```typescript
const existing = await getUserScore(userId, period);
if (!existing || data.score > existing.score) {
  await saveScore(data);
}
```

Use atomic operations (Redis `ZADD` with `XX`/`GT` flags) or database `INSERT ... ON CONFLICT DO UPDATE SET score = GREATEST(scores.score, EXCLUDED.score)`.
