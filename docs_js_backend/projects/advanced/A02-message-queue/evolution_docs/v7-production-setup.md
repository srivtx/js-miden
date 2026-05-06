# v7 — Production Setup (Redis + DLQ + Exactly-Once)

Your queue works. But it's in-memory. One restart and every job is gone. You need persistence, retries, and eventually exactly-once semantics.

---

## Architecture Evolution: Array → File → Redis + Services

```
In-Memory Array (v1-v5)
    ↓
File-Based Queue (intermediate)
    ↓
Redis + BullMQ (v7)
    ↓
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Producer   │────▶│    Redis    │────▶│   Worker    │
│   Service   │     │   (BullMQ)  │     │   Service   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │     DLQ     │
                    └─────────────┘
```

---

## Pain #1: Process Restarts Kill Jobs

You deploy a hotfix. The Node process restarts. 50 unprocessed jobs vanish. Users don't get their emails.

**Fix:** Redis-backed queues with BullMQ.

```ts
// producer-service/src/index.ts
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis({ host: process.env.REDIS_HOST });
const emailQueue = new Queue('emails', { connection });

app.post('/enqueue/:queue', async (req, res) => {
  const job = await emailQueue.add(req.params.queue, req.body.payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  });
  logger.info({ jobId: job.id, queue: req.params.queue }, 'Job enqueued to Redis');
  res.json({ status: 'enqueued', jobId: job.id });
});
```

Jobs live in Redis. Restart the producer? Jobs survive. Restart the worker? Jobs survive.

---

## Pain #2: Failed Jobs Are Lost

A job fails 3 times. It's discarded. The user never gets their email. No one knows.

**Fix:** Dead Letter Queue (DLQ).

```ts
// worker-service/src/index.ts
import { Worker, Job } from 'bullmq';

const worker = new Worker('emails', async (job: Job) => {
  logger.info({ jobId: job.id }, 'Processing job');
  await sendEmail(job.data);
}, {
  connection,
  concurrency: 5,
});

worker.on('failed', (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
    logger.error({ jobId: job.id, error: err.message }, 'Job exhausted retries, moved to DLQ');
    // BullMQ automatically moves to failed set (DLQ behavior)
  }
});
```

Failed jobs are preserved in Redis with their failure reason. You can inspect, retry, or alert on them.

---

## Pain #3: At-Least-Once Is Not Enough

A worker processes a payment job, charges the card, then crashes before acknowledging. The job is retried. The card is charged twice.

**Fix:** Exactly-once processing with idempotency keys.

```ts
// worker-service/src/processor.ts
import { Job } from 'bullmq';

async function processPaymentJob(job: Job) {
  const idempotencyKey = `payment:${job.id}`;

  // Check if already processed
  const existing = await redis.get(idempotencyKey);
  if (existing) {
    logger.info({ jobId: job.id }, 'Job already processed, skipping');
    return JSON.parse(existing);
  }

  // Process
  const result = await chargeCard(job.data);

  // Mark as processed (TTL to clean up)
  await redis.setex(idempotencyKey, 86400, JSON.stringify(result));

  return result;
}
```

The idempotency key ensures that even if the job runs twice, the side effect happens once.

---

## Pain #4: Workers Crash and Don't Restart

A worker dies. No one notices. The queue grows. Jobs sit unprocessed for hours.

**Fix:** Health checks + graceful shutdown + process managers.

```ts
// worker-service/src/health.ts
import express from 'express';
const healthApp = express();

healthApp.get('/health', async (req, res) => {
  const isRedisOk = redis.status === 'ready';
  res.status(isRedisOk ? 200 : 503).json({ redis: isRedisOk });
});

healthApp.listen(3001);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker...');
  await worker.close();
  await connection.quit();
  process.exit(0);
});
```

Kubernetes or PM2 checks `/health`. Unhealthy workers restart. SIGTERM drains active jobs before exit.

---

## Pain #5: Queue Growth Is Invisible

Your queue has 100,000 jobs. You don't know. The backlog grows until Redis runs out of memory.

**Fix:** Metrics and alerting.

```ts
setInterval(async () => {
  const jobs = await emailQueue.getJobCounts('wait', 'active', 'completed', 'failed');
  logger.info(jobs, 'Queue metrics');

  if (jobs.wait > 10000) {
    alert('Queue backlog > 10,000');
  }
  if (jobs.failed > 100) {
    alert('DLQ growing > 100 failed jobs');
  }
}, 30000);
```

---

## Final Checklist

- [ ] Redis persistence: jobs survive restarts
- [ ] Dead Letter Queue: failed jobs preserved, not lost
- [ ] Exactly-once: idempotency keys prevent duplicate processing
- [ ] Retry with backoff: exponential delays between attempts
- [ ] Health checks: `/health` on every service
- [ ] Graceful shutdown: drain active jobs on SIGTERM
- [ ] Queue metrics: backlog, active, completed, failed counts
- [ ] Alerting: notify on backlog or DLQ growth
- [ ] Environment-based config: Redis host, retry limits

This is a production message queue. It started as a naive in-memory array. Now it's a resilient, distributed system with persistence, retries, dead letter queues, and exactly-once processing guarantees.
