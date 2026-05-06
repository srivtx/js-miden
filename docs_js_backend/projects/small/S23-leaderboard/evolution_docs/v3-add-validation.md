# S23 Leaderboard — v3 Add Validation

## The Bug: Validation Catches Score Bugs

Your TypeScript leaderboard accepts any request:

```ts
export async function submitScore(data: { userId: string; username: string; score: number }): Promise<ScoreEntry> {
  const entry: ScoreEntry = {
    id: generateId(),
    userId: data.userId,
    username: data.username,
    score: data.score,
    timestamp: new Date(),
    period: data.period || 'all-time',
  };
  // ...
}
```

Without validation:
- `score: -100` — TypeScript says it's a `number`, but negative scores don't make sense
- `score: 999999999` — impossibly high score suggests cheating
- `userId: ''` — empty user ID breaks the leaderboard
- `username: ''` — anonymous entries are not useful
- `period: 'monthly'` as string — TypeScript with `as any` bypasses the union

TypeScript ensures the types match, but it doesn't validate score ranges or user identity at runtime.

## The Fix: Runtime Score Validation

```ts
function validateScoreSubmission(data: { userId: string; username: string; score: number; period?: string }): void {
  if (!data.userId || data.userId.trim().length === 0) {
    throw new Error('userId is required');
  }
  if (!data.username || data.username.trim().length === 0) {
    throw new Error('username is required');
  }
  if (isNaN(data.score) || data.score < 0) {
    throw new Error('score must be a non-negative number');
  }
  if (data.score > 1000000) {
    throw new Error('score exceeds maximum allowed value');
  }
  const validPeriods: string[] = ['daily', 'weekly', 'all-time'];
  if (data.period && !validPeriods.includes(data.period)) {
    throw new Error(`period must be one of: ${validPeriods.join(', ')}`);
  }
}
```

```ts
export async function submitScore(data: { userId: string; username: string; score: number; period?: 'daily' | 'weekly' | 'all-time' }): Promise<ScoreEntry> {
  validateScoreSubmission(data);
  // ...
}
```

**What validation prevents:**
- Negative scores are rejected
- Impossibly high scores are blocked (cheating detection)
- Empty user IDs are refused
- Invalid periods are caught

## The Pain That Remains

You validate submissions, but you still have no visibility into leaderboard performance. When queries slow down, you don't know if it's due to data volume or inefficient sorting. There's no logging of query latency or score distribution.

## What v4 Fixes

Logging. Observe leaderboard behavior in production.
