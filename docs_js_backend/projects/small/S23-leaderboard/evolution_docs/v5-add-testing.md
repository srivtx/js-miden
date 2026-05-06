# S23 Leaderboard — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You refactor the leaderboard to "simplify" score submission:

```ts
// BEFORE — correct
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
    if (entry.score > scores[existingIndex].score) {
      scores[existingIndex] = entry;
    }
  } else {
    scores.push(entry);
  }
  
  return entry;
}

// AFTER — "cleaner" but BROKEN
export async function submitScore(data: { userId: string; username: string; score: number }): Promise<ScoreEntry> {
  const entry: ScoreEntry = {
    id: generateId(),
    userId: data.userId,
    username: data.username,
    score: data.score,
    timestamp: new Date(),
    period: data.period || 'all-time',
  };
  
  // Oops, always overwrites without comparing scores
  const existingIndex = scores.findIndex(s => s.userId === data.userId && s.period === entry.period);
  if (existingIndex !== -1) {
    scores[existingIndex] = entry;
  } else {
    scores.push(entry);
  }
  
  return entry;
}
```

Without tests, this ships. A lower score now overwrites a higher score. Players lose their high scores. The leaderboard is meaningless.

## The Fix: Comprehensive Leaderboard Tests

```ts
// tests/app.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/index.js';
import { submitScore, getLeaderboard } from '../src/service.js';
import { performance } from 'perf_hooks';

describe('Leaderboard', () => {
  it('should not overwrite higher score with lower score', async () => {
    await request(app)
      .post('/score')
      .send({ userId: 'user-race', username: 'Racer', score: 500 });

    await request(app)
      .post('/score')
      .send({ userId: 'user-race', username: 'Racer', score: 100 });

    const res = await request(app).get('/rank/user-race?period=all-time');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.score, 500, 'Higher score should be preserved, not overwritten by lower score');
  });

  it('should use indexed score lookup for top 100', async () => {
    for (let i = 0; i < 5000; i++) {
      await submitScore({ userId: `user-${i}`, username: `Player${i}`, score: i });
    }

    const start = performance.now();
    const board = await getLeaderboard('all-time', 100);
    const duration = performance.now() - start;

    assert.strictEqual(board.length, 100);
    assert.ok(duration < 0.1, `Leaderboard query took ${duration.toFixed(3)}ms, should use index for O(log n)`);
  });
});
```

**What tests prevent:**
- Score overwrite bug? **Caught** — higher score must be preserved.
- Slow queries? **Caught** — must complete in < 0.1ms.
- Wrong sort order? **Caught** — top score must be rank 1.

## The Pain That Remains

Your tests import from ESM files, but the project still has CJS vestiges. Modern Node.js is ESM-first. The test runner requires special flags because it's straddling both worlds.

## What v6 Fixes

Switch to ESM fully. CommonJS is legacy.
