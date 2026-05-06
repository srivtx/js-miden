# v4-add-logging

## Goal
Observe queue depth, job durations, and failures.

## Changes
1. `pino` logger.
2. Log job enqueue, start, completion, and failure.
3. Log queue depth periodically.

## Code

```ts
// src/services/queue.ts
import { logger } from '../logger.js';

const worker = new Worker(
  'jobQueue',
  async (job: Job) => {
    logger.info({ jobId: job.id, type: job.data.type }, 'job_start');
    const start = performance.now();

    switch (job.data.type) {
      case 'email': return emailProcessor(job);
      case 'image': return imageProcessor(job);
      case 'export': return exportProcessor(job);
      default: throw new Error('Unknown job type');
    }
  },
  { connection: redis }
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'job_completed');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'job_failed');
});
```

## Decisions
- Log at worker level, not inside every processor — DRY.
- `performance.now()` inside the processor for sub-millisecond accuracy.

## Risks
- High log volume if queue has thousands of jobs. Use sampling or log only failures in high-traffic environments.
