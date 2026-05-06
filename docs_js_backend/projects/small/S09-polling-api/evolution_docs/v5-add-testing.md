# v5 — Adding Tests

You just "fixed" the race condition by switching to atomic increments. You deploy. A user reports that duplicate votes are slipping through.

You check. Your atomic increment works. But your duplicate-check query has a bug: you're checking `ip = ?` but `req.ip` is `undefined` behind a load balancer. Every vote looks like it comes from `undefined`.

Tests would have caught this.

## The Fix: Automated Tests

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Polling API', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM votes').run();
    db.prepare('DELETE FROM options').run();
    db.prepare('DELETE FROM polls').run();
  });

  it('creates a poll', async () => {
    const res = await request(app)
      .post('/polls')
      .send({ question: 'A or B?', options: ['A', 'B'] });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('prevents duplicate votes by IP', async () => {
    const poll = await request(app)
      .post('/polls')
      .send({ question: 'X or Y?', options: ['X', 'Y'] });
    const pollId = poll.body.id;
    const options = db.prepare('SELECT id FROM options WHERE poll_id = ?').all(pollId) as { id: number }[];

    await request(app).post(`/polls/${pollId}/vote`).send({ option_id: options[0].id });
    const res2 = await request(app).post(`/polls/${pollId}/vote`).send({ option_id: options[0].id });
    expect(res2.status).toBe(403);
  });

  it('increments vote count atomically', async () => {
    // Seed and vote
    // Verify count is exactly 1, not NaN, not missing
  });
});
```

## What Tests Caught

- The `req.ip` bug → mock the header and test
- The race condition → test concurrent votes
- The missing option_id validation → test with invalid IDs

## The Confidence

Green tests mean the poll logic is solid. You can add features (multiple choice, time limits) without fear.

**Next:** Let's modernize the module system.
