# v2-add-typescript

## Goal
Type the job queue before adding BullMQ and retry logic.

## Changes
1. Rename `.js` → `.ts`.
2. Define `Job`, `JobStatus`, and processor types.
3. Add return types to controller functions.

## Code

```ts
// src/services/queue.ts
import { Queue, Job, Worker } from 'bullmq';
import IORedis from 'ioredis';

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });

export const jobQueue = new Queue('jobQueue', { connection: redis });
export const deadLetterQueue = new Queue('deadLetterQueue', { connection: redis });
```

```ts
// src/controller.ts
import { Request, Response } from 'express';
import { addJob, getJob, cancelJob as cancelQueueJob } from './services/queue.js';

export async function enqueueJob(req: Request, res: Response) {
  const { type, payload } = req.body;
  if (!type || !payload) return res.status(400).json({ error: 'type and payload required' });

  const job = await addJob(type, payload);
  return res.status(201).json({ id: job.id, status: job.status });
}
```

## Decisions
- `bullmq` types are excellent — no need for custom wrappers yet.
- `ioredis` with `maxRetriesPerRequest: null` is required by BullMQ to handle its own retry logic.

## Risks
- Redis is now a hard dependency. Add health checks before exposing enqueue endpoint.
