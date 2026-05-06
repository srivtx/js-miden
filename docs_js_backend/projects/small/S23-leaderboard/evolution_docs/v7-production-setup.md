# S23 Leaderboard — v7 Production Setup

## Connect to src/

This is the final state. All evolutions converge into a clean, production-ready structure.

### Directory Structure

```
S23-leaderboard/
├── src/
│   ├── index.ts            # Express app
│   ├── routes.ts           # HTTP endpoints
│   ├── service.ts          # Score storage + leaderboard logic
│   └── types.ts            # TypeScript interfaces
├── tests/
│   └── app.test.ts         # Node.js test runner + supertest
├── evolution_docs/         # This documentation
├── package.json
├── tsconfig.json
└── dist/                   # Compiled JS (gitignored)
```

### Key Production Decisions

**1. Time-Windowed Leaderboards**

```ts
function isInPeriod(entry: ScoreEntry, period: 'daily' | 'weekly' | 'all-time'): boolean {
  if (period === 'all-time') return true;
  const now = new Date();
  if (period === 'daily') {
    return entry.timestamp >= getStartOfDay(now);
  }
  return entry.timestamp >= getStartOfWeek(now);
}
```

Scores are filtered by period before ranking. Daily leaderboards reset at midnight, weekly on Sunday.

**2. Sorted Data Structure**

```ts
const scores: ScoreEntry[] = [];

filtered.sort((a, b) => b.score - a.score);
```

In production, this would be a Redis Sorted Set (`ZADD`, `ZREVRANGE`) or a database index on `(period, score DESC)`. The in-memory array simulates the logic for learning purposes.

**3. Rank Queries**

```ts
export async function getUserRank(userId: string, period: 'daily' | 'weekly' | 'all-time'): Promise<LeaderboardEntry | null> {
  const board = await getLeaderboard(period, scores.length);
  const entry = board.find(e => e.userId === userId);
  return entry || null;
}
```

User rank is computed by generating the full leaderboard and finding the user's position. In production, this would use `ZREVRANK` in Redis.

**4. Score Preservation**

```ts
const existingIndex = scores.findIndex(s => s.userId === data.userId && s.period === entry.period);
if (existingIndex !== -1) {
  // Overwrites without comparing scores
  scores[existingIndex] = entry;
}
```

In production, only the highest score per user per period should be kept. Lower scores should be rejected.

**5. Self-execution Guard**

```ts
if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT);
}
```

Tests import `{ app }` without starting the server.

### The Intentional Bugs (For Learning)

The source code contains two bugs:

**Bug 1: Full Table Scan**
```ts
// BUG: Full table scan — no index on score, O(n) for top 100.
// For large datasets this sorts the entire table every time.
const filtered = scores.filter(s => isInPeriod(s, period));
filtered.sort((a, b) => b.score - a.score);
```

Every leaderboard query sorts all scores. With 1M+ scores, this is O(n log n) and unusable.

**Bug 2: Race Condition — Lower Score Overwrites Higher**
```ts
// BUG: Race condition — two submissions, lower score overwrites higher.
// We should check if an existing score exists and only update if higher.
const existingIndex = scores.findIndex(s => s.userId === data.userId && s.period === entry.period);
if (existingIndex !== -1) {
  // Overwrites without comparing scores
  scores[existingIndex] = entry;
}
```

A lower score submitted after a higher score will overwrite it. The leaderboard loses the user's best score.

**Why are these here?** To demonstrate that a leaderboard without tests is worse than no leaderboard. The tests in `app.test.ts` verify:
- Higher score must be preserved, not overwritten by lower score
- Top-100 query must be near-instant (< 0.1ms)

### Evolution Summary

| Version | Pain | Fix |
|---------|------|-----|
| v1 | In-memory, no time windows, no rank queries | Wrote naive JS |
| v2 | Type errors in score handling | Added TypeScript |
| v3 | Invalid scores entering leaderboard | Added runtime validation |
| v4 | Silent score overwrites | Added structured logging |
| v5 | Score overwrite bug, full table scan | Added comprehensive leaderboard tests |
| v6 | Legacy module system | Full ESM alignment |
| v7 | Disorganized project | Clean `src/` structure |

### Running the Final Version

```bash
npm install
npm run dev      # node --watch --loader ts-node/esm src/index.ts
npm run build    # tsc
npm start        # node dist/index.js
npm test         # node --test tests/**/*.test.ts
```

**Note:** This project uses the Node.js built-in test runner (not Jest/Vitest) to demonstrate native ESM + TypeScript testing without external test frameworks.
