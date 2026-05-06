# S23 Leaderboard — v2 Add TypeScript

## The Bug: Types Catch Score Bugs

You add period-based leaderboards:

```js
function getLeaderboard(period, limit) {
  const filtered = scores.filter(s => isInPeriod(s, period));
  filtered.sort((a, b) => b.score - a.score);
  return filtered.slice(0, limit);
}
```

**The bug:** `period` might be `'monthly'` — a value you don't support. `isInPeriod` returns `false` for everything. The leaderboard is empty. Another bug:
```js
const entry = {
  id: generateId(),
  userId: data.userId,
  username: data.username,
  score: data.score,
  timestamp: new Date(),
  period: data.period || 'all-time',
};
```

Without types, `score: '100'` (a string) is accepted. Sorting strings lexicographically gives `'99' > '100'`. Your leaderboard is wrong.

## The Fix: Add TypeScript

```ts
// types.ts
export interface ScoreEntry {
  id: string;
  userId: string;
  username: string;
  score: number;
  timestamp: Date;
  period: 'daily' | 'weekly' | 'all-time';
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
}

export interface SubmitScoreRequest {
  userId: string;
  username: string;
  score: number;
  period?: 'daily' | 'weekly' | 'all-time';
}
```

```ts
export async function getLeaderboard(
  period: 'daily' | 'weekly' | 'all-time',
  limit: number
): Promise<LeaderboardEntry[]> {
  const filtered = scores.filter(s => isInPeriod(s, period));
  filtered.sort((a, b) => b.score - a.score);
  return filtered.slice(0, limit).map((entry, index) => ({
    rank: index + 1,
    userId: entry.userId,
    username: entry.username,
    score: entry.score,
  }));
}
```

**What TS catches:**
- `period: 'monthly'` → compile error: not in union type
- `score: '100'` → compile error: string not assignable to number
- Missing `rank` in return → compile error

## The Pain That Remains

TypeScript knows `score` is a `number`, but it doesn't enforce that `score >= 0`. It doesn't prevent a negative score from entering the leaderboard. It doesn't know that `limit` should be capped at 100. We need runtime validation.

## What v3 Fixes

Validation. Ensure every score submission is sane before it enters the leaderboard.
