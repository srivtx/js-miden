# 03-CONCEPTS.md

## WHAT

A leaderboard service that:
1. Accepts score submissions with user metadata
2. Ranks players by score in descending order
3. Supports time-based filters (daily, weekly, all-time)
4. Queries individual player ranks
5. Prevents lower scores from overwriting higher scores

## WHY

| Without This Service | With This Service |
|---------------------|-------------------|
| Leaderboard loads in 500ms+ | Leaderboard loads in < 1ms |
| Race conditions corrupt rankings | Atomic updates preserve highest score |
| Database scans on every page view | Indexed lookups with O(log n) |
| Memory grows unbounded (all scores kept) | One entry per player per period |
| No time-based competition | Daily/weekly resets keep engagement fresh |

## HOW

### Step 1: Submit Score
```typescript
POST /score
{
  "userId": "user-1",
  "username": "Alice",
  "score": 1500,
  "period": "daily"
}
```

### Step 2: Store with Conditional Update
```typescript
// Check existing score first
const existing = await getUserScore(userId, period);

if (!existing || newScore > existing.score) {
  await saveScore({ userId, username, score: newScore, period });
}
```

### Step 3: Query Top N (Redis)
```typescript
// Add to sorted set
await redis.zadd(`leaderboard:${period}`, score, userId);

// Get top 100
const top = await redis.zrevrange(`leaderboard:${period}`, 0, 99, 'WITHSCORES');
// Returns: [['user-5', '2500'], ['user-1', '1500'], ...]
```

### Step 4: Get User Rank
```typescript
const rank = await redis.zrevrank(`leaderboard:${period}`, userId);
// Returns: 0-based index (add 1 for human-readable rank)
```

## WRONG vs RIGHT

### WRONG: Unconditional Overwrite
```typescript
const existingIndex = scores.findIndex(s => s.userId === data.userId);
if (existingIndex !== -1) {
  scores[existingIndex] = entry;  // 500 overwrites 1000!
}
```

### RIGHT: Compare Before Update
```typescript
const existing = await redis.zscore(`leaderboard:${period}`, userId);
if (!existing || data.score > existing) {
  await redis.zadd(`leaderboard:${period}`, data.score, userId);
}
```

### WRONG: Full Table Scan
```typescript
const filtered = scores.filter(s => isInPeriod(s, period));
filtered.sort((a, b) => b.score - a.score);  // O(n log n)
return filtered.slice(0, limit);
```

### RIGHT: Indexed Range Query
```typescript
// Redis already maintains the sort
const top = await redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');
// O(log n + limit)
```

## ASCII: Data Flow

```
+--------+     +-----------+     +----------------+     +---------+
| Client |---->|  Express  |---->| Conditional    |---->| Redis   |
+--------+     |  Router   |     | Score Update   |     | Sorted  |
               +-----------+     +----------------+     | Set     |
                     |                |                 +---------+
                     v                v                      |
               +-----------+     +----------------+          |
               | GET /rank |     | ZREVRANGE      |<---------+
               +-----------+     | (top 100)      |
                                 +----------------+
```

## ASCII: Race Condition

```
Thread A reads score: 1000
                    |
Thread B reads score: 1000
                    |
Thread A writes: 500 (lower)
                    |
Thread B writes: 800 (higher)
                    |
Result: 800 (WRONG — should be 1000, the highest)

Fix: Atomic compare-and-swap or database constraint
```
