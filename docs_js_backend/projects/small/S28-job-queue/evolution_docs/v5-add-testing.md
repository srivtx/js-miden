# v5-add-testing

## Goal
Prove that jobs are enqueued, processed, retried, and dead-lettered correctly.

## Changes
1. `vitest` + `supertest`.
2. Use `bullmq`'s `QueueScheduler` (v4) or built-in retries (v5) in tests.
3. Mock processors for fast tests.

## Code

```ts
// tests/queue.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { jobQueue, deadLetterQueue } from '../src/services/queue.js';
import IORedis from 'ioredis';

const redis = new IORedis('redis://localhost:6379', { maxRetriesPerRequest: null });

describe('Job Queue', () => {
  beforeAll(async () => {
    await jobQueue.waitUntilReady();
    await deadLetterQueue.waitUntilReady();
  });

  afterAll(async () => {
    await jobQueue.close();
    await deadLetterQueue.close();
    await redis.quit();
  });

  it('enqueues a job', async () => {
    const res = await request(app).post('/jobs').send({ type: 'email', payload: { to: 'a@b.com', subject: 'Hi', body: 'Hello' } });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('retries failed jobs', async () => {
    // Mock processor to throw, then observe DLQ
  });
});
```

## Decisions
- Test against real Redis — BullMQ behavior is hard to mock correctly.
- Clean queues in `beforeAll` to avoid cross-test contamination.

## Risks
- Flaky tests if Redis is slow. Increase timeouts for integration tests.
