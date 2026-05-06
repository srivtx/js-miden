# v5 — Adding Testing

You "optimized" dequeue by returning the last item instead of the first (faster array pop). You deploy. Now jobs are processed in reverse order. A user expected email A to send before email B. It didn't. You have no test for FIFO ordering.

## The Fix: Automated Tests

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Message Queue', () => {
  it('enqueues and dequeues in FIFO order', async () => {
    await request(app).post('/enqueue/test').send({ payload: { n: 1 } });
    await request(app).post('/enqueue/test').send({ payload: { n: 2 } });

    const r1 = await request(app).post('/dequeue/test');
    const r2 = await request(app).post('/dequeue/test');

    expect(r1.body.payload.n).toBe(1);
    expect(r2.body.payload.n).toBe(2);
  });

  it('returns 204 when queue is empty', async () => {
    await request(app).post('/dequeue/empty-queue').expect(204);
  });

  it('rejects enqueue without payload', async () => {
    await request(app)
      .post('/enqueue/test')
      .send({ queue: 'test' })
      .expect(400);
  });

  it('isolates queues by name', async () => {
    await request(app).post('/enqueue/a').send({ payload: { msg: 'a' } });
    await request(app).post('/enqueue/b').send({ payload: { msg: 'b' } });

    const r = await request(app).post('/dequeue/a');
    expect(r.body.payload.msg).toBe('a');
  });
});
```

## What Tests Caught

- LIFO regression → caught
- Empty queue handling → caught
- Payload validation → caught
- Queue isolation → caught

## The Confidence

Now you can swap the in-memory array for Redis, add acknowledgements, or implement retries and know that FIFO ordering and queue isolation still hold.

**Next:** Let's switch to ESM before introducing external storage.
