import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/index.js';
import { submitScore, getLeaderboard } from '../src/service.js';
import { performance } from 'perf_hooks';

describe('Leaderboard', () => {
  it('should submit a score', async () => {
    const res = await request(app)
      .post('/score')
      .send({ userId: 'user-1', username: 'Alice', score: 100 });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.score, 100);
  });

  it('should return top 100 leaderboard', async () => {
    await request(app).post('/score').send({ userId: 'user-1', username: 'Alice', score: 100 });
    await request(app).post('/score').send({ userId: 'user-2', username: 'Bob', score: 200 });

    const res = await request(app).get('/leaderboard?period=all-time');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 2);
    assert.strictEqual(res.body[0].username, 'Bob');
    assert.strictEqual(res.body[0].rank, 1);
  });

  // FAILING TEST: Full table scan — no index on score.
  it('should use indexed score lookup for top 100', async () => {
    // Add many scores directly to avoid HTTP overhead
    for (let i = 0; i < 5000; i++) {
      await submitScore({ userId: `user-${i}`, username: `Player${i}`, score: i });
    }

    const start = performance.now();
    const board = await getLeaderboard('all-time', 100);
    const duration = performance.now() - start;

    assert.strictEqual(board.length, 100);
    // With a proper index, top-100 queries should be near-instant (< 0.1ms)
    // Full table scan takes measurable time even on small datasets
    assert.ok(duration < 0.1, `Leaderboard query took ${duration.toFixed(3)}ms, should use index for O(log n)`);
  });

  // FAILING TEST: Race condition — lower score overwrites higher.
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
});
