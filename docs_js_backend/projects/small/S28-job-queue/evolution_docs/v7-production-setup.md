# v7-production-setup

## Goal
Run a resilient job queue with retries, dead-letter queue, progress tracking, and graceful shutdown.

## Changes
1. **BullMQ workers** — Redis-backed, with concurrency limits.
2. **Retry policy** — Exponential backoff, 3 attempts by default.
3. **Dead-letter queue (DLQ)** — Jobs that exhaust retries move to DLQ for inspection.
4. **Progress tracking** — `job.updateProgress(0..100)` visible via `/jobs/:id`.
5. **Graceful shutdown** — Pause workers, finish in-flight jobs, then exit.
6. **Rate limiting** — Limit enqueue per IP.
7. **Structured logging** — `pino` with job metadata.
8. **Health checks** — `/health` checks Redis and worker liveness.

## Code

```ts
// src/services/queue.ts
export async function addJob(type: string, payload: any) {
  const job = await jobQueue.add(type, { type, payload }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  });
  return job;
}

export async function getJob(id: string) {
  const job = await jobQueue.getJob(id);
  if (!job) return null;
  const state = await job.getState();
  return {
    id: job.id,
    status: state,
    progress: job.progress,
    result: job.returnvalue,
  };
}

export async function cancelJob(id: string) {
  const job = await jobQueue.getJob(id);
  if (job) {
    await job.discard();
    await job.moveToFailed(new Error('Cancelled by user'), '0', true);
  }
}
```

```ts
// src/services/processors.ts
export async function emailProcessor(job: Job) {
  await job.updateProgress(10);
  // ... send email
  await job.updateProgress(100);
  return { sent: true };
}
```

```ts
// src/index.ts
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received');
  await worker.close();
  await jobQueue.close();
  await deadLetterQueue.close();
  await redis.quit();
  server.close(() => process.exit(0));
});
```

## Decisions
- **BullMQ over Bull** — BullMQ is the modern rewrite with better TypeScript and fewer dependencies.
- **Exponential backoff** — Prevents thundering herd on a temporarily down service.
- **DLQ** — Essential for debugging; without it, failed jobs disappear.
- **Progress tracking** — UX feature for long-running exports/image processing.

## Risks
- Redis is a single point of failure. Use Redis Sentinel or Cluster for HA.
- Worker crash during processing can leave a job stalled. BullMQ has stalled-job recovery, but tune `stalledInterval`.

## ASCII: Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│   Express    │────▶│   Redis     │
│             │     │  Rate Limit  │     │  Job Queue  │
└─────────────┘     └──────────────┘     └─────────────┘
                              │                   │
                              │                   ▼
                              │            ┌──────────┐
                              │            │  Worker  │
                              │            │ Processor│
                              │            └──────────┘
                              │                   │
                              │                   ▼
                              │            ┌──────────┐
                              └───────────▶│    DLQ   │
                                           └──────────┘
```
