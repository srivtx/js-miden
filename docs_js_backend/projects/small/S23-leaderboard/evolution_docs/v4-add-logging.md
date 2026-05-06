# S23 Leaderboard — v4 Add Logging

## The Bug: Production Visibility Crisis

Your leaderboard is supposed to rank players fairly. But in production:
- You don't know how many scores are submitted per minute
- You can't tell if queries are slow due to data volume
- You have no record of overwritten scores (race conditions)
- You don't know which time windows are most active

```ts
// Without logging — silent leaderboard
export async function submitScore(data: { userId: string; username: string; score: number }): Promise<ScoreEntry> {
  const entry: ScoreEntry = {
    id: generateId(),
    userId: data.userId,
    username: data.username,
    score: data.score,
    timestamp: new Date(),
    period: data.period || 'all-time',
  };
  
  const existingIndex = scores.findIndex(s => s.userId === data.userId && s.period === entry.period);
  if (existingIndex !== -1) {
    scores[existingIndex] = entry;
  } else {
    scores.push(entry);
  }
  
  return entry;
}
```

A user submits a score of 100, then immediately submits 50. The 50 overwrites the 100. You have no log. The user complains their high score is gone. You have no evidence.

## The Fix: Structured Logging

```ts
import { logger } from './logger.js';

export async function submitScore(data: { userId: string; username: string; score: number; period?: 'daily' | 'weekly' | 'all-time' }): Promise<ScoreEntry> {
  validateScoreSubmission(data);
  
  const entry: ScoreEntry = {
    id: generateId(),
    userId: data.userId,
    username: data.username,
    score: data.score,
    timestamp: new Date(),
    period: data.period || 'all-time',
  };
  
  const existingIndex = scores.findIndex(s => s.userId === data.userId && s.period === entry.period);
  if (existingIndex !== -1) {
    const existing = scores[existingIndex];
    if (entry.score > existing.score) {
      logger.info({ userId: data.userId, oldScore: existing.score, newScore: entry.score, period: entry.period }, 'Score improved');
      scores[existingIndex] = entry;
    } else {
      logger.info({ userId: data.userId, existingScore: existing.score, rejectedScore: entry.score, period: entry.period }, 'Score rejected — lower than existing');
    }
  } else {
    scores.push(entry);
    logger.info({ userId: data.userId, score: entry.score, period: entry.period }, 'New score submitted');
  }
  
  return entry;
}

export async function getLeaderboard(period: 'daily' | 'weekly' | 'all-time', limit: number): Promise<LeaderboardEntry[]> {
  const start = performance.now();
  const filtered = scores.filter(s => isInPeriod(s, period));
  filtered.sort((a, b) => b.score - a.score);
  const result = filtered.slice(0, limit).map((entry, index) => ({
    rank: index + 1,
    userId: entry.userId,
    username: entry.username,
    score: entry.score,
  }));
  const duration = performance.now() - start;
  logger.info({ period, limit, count: filtered.length, durationMs: duration }, 'Leaderboard queried');
  return result;
}
```

Now logs tell the story:
```json
{"level":"info","userId":"alice","score":500,"period":"daily","msg":"New score submitted"}
{"level":"info","userId":"alice","oldScore":500,"newScore":600,"period":"daily","msg":"Score improved"}
{"level":"info","userId":"alice","existingScore":600,"rejectedScore":100,"period":"daily","msg":"Score rejected — lower than existing"}
{"level":"info","period":"daily","limit":100,"count":5000,"durationMs":45,"msg":"Leaderboard queried"}
```

**Ah.** Querying 5,000 records takes 45ms. We need an index. Also, score overwrites are now logged.

## The Pain That Remains

You refactor `getLeaderboard` and accidentally remove the sort. The leaderboard returns unsorted data. Your logs show queries returning quickly, but you don't have a test that verifies the sort order.

## What v5 Fixes

Testing. Every leaderboard behavior needs a test.
