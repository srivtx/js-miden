# 04-OLD-VS-NEW.md

## 2015 Approach (Naive / Array-Based)

### Architecture
- Scores stored in an unsorted array
- Every query filters and sorts the entire array
- Unconditional overwrite on duplicate submission
- Period filtering done in application code

### Code Pattern
```javascript
// 2015-style: Array storage, full scan, race-prone
var scores = [];

function submitScore(userId, score) {
  scores.push({ userId: userId, score: score });
}

function getLeaderboard(limit) {
  return scores
    .sort(function(a, b) { return b.score - a.score; })
    .slice(0, limit);
}
```

### Problems
- O(n log n) on every read
- Memory grows forever (every submission stored)
- Race condition: lower score overwrites higher
- No efficient rank lookup for a specific player

---

## 2025 Approach (Indexed / Redis-Based)

### Architecture
- Redis Sorted Sets store one entry per player per period
- O(log n) inserts and range queries
- Atomic conditional updates (ZADD with GT flag)
- Separate keys for daily/weekly/all-time periods

### Code Pattern
```typescript
// 2025-style: Redis Sorted Sets, atomic, fast
async function submitScore(userId: string, score: number, period: string) {
  const key = `leaderboard:${period}`;
  
  // Redis 6.2+: GT = only update if new score is greater
  const updated = await redis.zadd(key, 'GT', score, userId);
  
  if (updated) {
    await redis.hset(`player:${userId}`, 'username', username);
  }
}

async function getLeaderboard(period: string, limit: number) {
  const key = `leaderboard:${period}`;
  const results = await redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');
  
  return results.map(([userId, score], index) => ({
    rank: index + 1,
    userId,
    score: parseInt(score),
  }));
}

async function getUserRank(userId: string, period: string) {
  const rank = await redis.zrevrank(`leaderboard:${period}`, userId);
  return rank !== null ? rank + 1 : null;
}
```

### Advantages
- Query latency: 500ms → 0.1ms (5,000× faster)
- Memory: O(total submissions) → O(total players)
- Race conditions: eliminated by atomic Redis operations
- Rank lookup: O(n) scan → O(log n) indexed lookup
- Period resets: TTL on Redis keys auto-expires old periods

## ASCII: Performance Comparison

```
2015 (Array)                                2025 (Redis)
============                                ============

10,000 scores                               10,000 scores
     |                                            |
     v                                            v
+----------+                              +----------+
| filter() | 5ms                           | ZADD     | 0.05ms
| sort()   | 50ms                          | (insert) |
| slice()  | 1ms                           +----------+
+----------+                                     |
Total: 56ms                                      v
                                            +----------+
                                            |ZREVRANGE | 0.1ms
                                            +----------+
                                            Total: 0.15ms

Speedup: 373x
```
