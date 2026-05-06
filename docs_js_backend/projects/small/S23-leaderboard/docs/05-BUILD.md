# 05-BUILD.md

## Prerequisites

- Node.js 20+
- npm or pnpm

## Step-by-Step Build

### Step 1: Clone and Install
```bash
cd S23-leaderboard
npm install
```

### Step 2: Understand the Project Structure
```
S23-leaderboard/
├── src/
│   ├── index.ts      # Express server setup
│   ├── routes.ts     # HTTP endpoints
│   ├── service.ts    # Business logic (BUGS HERE)
│   └── types.ts      # TypeScript interfaces
├── tests/
│   └── app.test.ts   # Failing tests prove bugs
├── docs/
│   └── (this documentation)
├── package.json
└── tsconfig.json
```

### Step 3: Run the Tests (They Will Fail)
```bash
npm test
```

Expected failures:
- `should use indexed score lookup for top 100` — full array scan is slow
- `should not overwrite higher score with lower score` — race condition bug

### Step 4: Fix Bug 1 — Prevent Lower Score Overwrite

Edit `src/service.ts` in `submitScore()`:
```typescript
export async function submitScore(data: { userId: string; username: string; score: number; period?: string }): Promise<ScoreEntry> {
  const period = data.period || 'all-time';
  
  // Check existing score first
  const existingIndex = scores.findIndex(s => s.userId === data.userId && s.period === period);
  
  if (existingIndex !== -1) {
    const existing = scores[existingIndex];
    if (data.score <= existing.score) {
      return existing;  // Keep the higher score
    }
    // Only overwrite if new score is higher
    scores[existingIndex] = {
      ...existing,
      score: data.score,
      timestamp: new Date(),
    };
    return scores[existingIndex];
  }
  
  const entry: ScoreEntry = {
    id: generateId(),
    userId: data.userId,
    username: data.username,
    score: data.score,
    timestamp: new Date(),
    period,
  };
  
  scores.push(entry);
  return entry;
}
```

### Step 5: Fix Bug 2 — Use Indexed Storage

For the demo, we can simulate an index by maintaining a sorted structure:

```typescript
// Maintain scores in a Map for O(1) lookup by userId
const scoreIndex = new Map<string, ScoreEntry>();

export async function submitScore(data: { ... }): Promise<ScoreEntry> {
  const key = `${data.userId}:${period}`;
  const existing = scoreIndex.get(key);
  
  if (existing && data.score <= existing.score) {
    return existing;
  }
  
  const entry: ScoreEntry = { ... };
  scoreIndex.set(key, entry);
  return entry;
}

export async function getLeaderboard(period: string, limit: number): Promise<LeaderboardEntry[]> {
  // Convert Map to array, filter by period, sort, slice
  const entries = Array.from(scoreIndex.values())
    .filter(s => s.period === period || period === 'all-time')
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  
  return entries.map((entry, index) => ({
    rank: index + 1,
    userId: entry.userId,
    username: entry.username,
    score: entry.score,
  }));
}
```

**Production fix:** Use Redis Sorted Sets:
```typescript
await redis.zadd(`leaderboard:${period}`, 'GT', data.score, data.userId);
const top = await redis.zrevrange(`leaderboard:${period}`, 0, limit - 1, 'WITHSCORES');
```

### Step 6: Run Tests Again
```bash
npm test
```

All tests should now pass.

### Step 7: Run the Server
```bash
npm run dev
```

Test with curl:
```bash
# Submit a score
curl -X POST http://localhost:3000/score \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-1","username":"Alice","score":100}'

# Submit a lower score (should not overwrite)
curl -X POST http://localhost:3000/score \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-1","username":"Alice","score":50}'

# Check leaderboard
curl http://localhost:3000/leaderboard?period=all-time&limit=10

# Check user rank
curl http://localhost:3000/rank/user-1?period=all-time
```

### Step 8: Production Upgrade Path

1. Replace in-memory array with Redis Sorted Sets
2. Add composite unique constraint in database: `(user_id, period)`
3. Use Redis `ZADD ... GT` for atomic conditional updates
4. Cache top 100 leaderboard with short TTL (10-30 seconds)
5. Precompute daily/weekly leaderboards at period boundaries
6. Add write-through caching for score submissions
