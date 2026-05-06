# 06-BUGS.md

## Bug 1: Race Condition in Score Update

**Location:** `src/service.ts`, `submitScore()` function, lines 45-51

**Current Code:**
```typescript
const existingIndex = scores.findIndex(s => s.userId === data.userId && s.period === entry.period);
if (existingIndex !== -1) {
  // Overwrites without comparing scores
  scores[existingIndex] = entry;
} else {
  scores.push(entry);
}
```

**Real-World Impact:**

### Scenario: Gaming Tournament
Player "ProGamer" scores 5000 points in a tournament. Due to network lag, the score submission is retried. The retry sends the intermediate score of 2000 (before the final combo).

- **Current behavior**: 2000 overwrites 5000
- **Player impact**: Drops from rank #1 to rank #47
- **Business impact**: Player demands refund, posts negative review, community backlash
- **Tournament impact**: Prize distribution is wrong. Legal liability.

### Scenario: Fitness App Step Counter
User walks 10,000 steps. Phone syncs in background, sends 8,000 steps first (mid-day sync), then 10,000 steps (end-of-day sync). Due to race condition, the 8,000 arrives last and overwrites 10,000.

- **Current behavior**: 8,000 overwrites 10,000
- **User impact**: Misses daily goal, loses streak, stops using app
- **Business impact**: Churn increases, NPS drops

### Scenario: Sales Leaderboard
Sales rep closes a $1M deal, then adds a $50K upsell. The upsell update races with the main deal update.

- **Current behavior**: $50K overwrites $1M
- **Business impact**: Incorrect commission calculation, HR dispute

**Severity:** HIGH — Corrupts user-facing data and business logic

**Fix:** Compare scores before overwriting.

```typescript
const existingIndex = scores.findIndex(s => s.userId === data.userId && s.period === period);
if (existingIndex !== -1) {
  if (data.score > scores[existingIndex].score) {
    scores[existingIndex] = entry;
  }
  // Else: keep existing higher score
} else {
  scores.push(entry);
}
```

**Production fix:** Database atomic constraint:
```sql
INSERT INTO scores (user_id, period, score) VALUES (?, ?, ?)
ON CONFLICT (user_id, period) DO UPDATE SET score = GREATEST(scores.score, EXCLUDED.score);
```

---

## Bug 2: Full Table Scan

**Location:** `src/service.ts`, `getLeaderboard()` function, lines 59-69

**Current Code:**
```typescript
const filtered = scores.filter(s => isInPeriod(s, period));
filtered.sort((a, b) => b.score - a.score);
return filtered.slice(0, limit).map((entry, index) => ({
  rank: index + 1,
  // ...
}));
```

**Real-World Impact:**

### Scenario: Mobile Game with 1M Players
Every time a player opens the leaderboard, the server sorts 1M entries.

- **Current behavior**: O(n log n) = ~20M comparisons per query
- **At 100 QPS**: 2 billion comparisons per second = 100% CPU usage
- **Result**: API latency spikes to 500ms+. Players complain about lag. App store ratings drop.

### Scenario: Live Tournament Stream
Tournament has 10,000 viewers refreshing the leaderboard every 5 seconds.

- **Current behavior**: 2,000 queries/second, each sorting 10K entries
- **Result**: Server melts. Stream crashes. Sponsors pull out.

### Scenario: Daily Leaderboard Reset
At midnight UTC, 50,000 players submit their daily scores simultaneously.

- **Current behavior**: 50K submissions + 50K leaderboard queries = 100K array operations
- **Result**: Memory pressure, garbage collection pauses, request timeouts

**Severity:** HIGH — Makes service unusable at scale

**Fix:** Use Redis Sorted Sets or database index.

```typescript
// Redis: O(log n) insert, O(log n + limit) query
await redis.zadd(`leaderboard:${period}`, score, userId);
const top = await redis.zrevrange(`leaderboard:${period}`, 0, 99, 'WITHSCORES');
```

---

## Additional Bug Surface

### No Deduplication of Players
The array allows multiple entries per player per period. The leaderboard shows the same player multiple times if they submit different scores.

**Fix:** Enforce one entry per `(userId, period)` via Map key or database unique constraint.

### No Pagination
`GET /leaderboard` returns all filtered entries. With 1M players, this is a multi-megabyte JSON response.

**Fix:** Always paginate with `limit` and `offset` parameters. Default `limit` to 100.
