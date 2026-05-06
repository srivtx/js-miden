# MD08 Distributed Job Queue — v7 Production Setup

> **Motto**: Jobs must be durable, retryable, and idempotent.

## What Changed

This is the full production-grade distributed job queue:
- **Redis** — persistent queue storage with BullMQ
- **BullMQ** — queues, workers, and schedulers with Redis backing
- **Retries** — exponential backoff for failed jobs (3 attempts by default)
- **DLQ** — dead letter queue for permanently failed jobs
- **Idempotency** — duplicate job requests return cached results instead of re-processing
- **Worker pools** — multiple worker processes share the queue for horizontal scaling
- **Progress tracking** — job progress stored in PostgreSQL for polling

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│   Express       │─────▶│     Redis       │
│  (Uploader) │◀─────│   API           │◀─────│   (BullMQ)      │
└─────────────┘      └─────────────────┘      └─────────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │  PostgreSQL  │
                       │  (jobs,      │
                       │   progress)  │
                       └──────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │  Worker Pool │
                       │  (BullMQ     │
                       │   Workers)   │
                       └──────────────┘
```

## Code

### BullMQ Queue

```typescript
// src/queue.ts
import { Queue, Worker, Job as BullJob } from 'bullmq';
import IORedis from 'ioredis';

const redis = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

export const videoQueue = new Queue('video-transcode', { connection: redis });

export async function addTranscodeJob(payload: object) {
  return videoQueue.add('transcode', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 10,
    removeOnFail: 5,
  });
}

export function createWorker(handler: (job: BullJob) => Promise<void>) {
  return new Worker('video-transcode', handler, {
    connection: redis,
    concurrency: 2,
  });
}
```

### Idempotency

```typescript
// src/routes/jobs.ts
import { Router } from 'express';
import { pool } from '../db.js';
import { addTranscodeJob } from '../queue.js';
import type { Request, Response } from 'express';
import crypto from 'crypto';

const router = Router();

function generateJobId(): string {
  return crypto.randomUUID();
}

router.post('/jobs', async (req: Request, res: Response) => {
  const { type, payload } = req.body;
  if (!type || !payload) {
    res.status(400).json({ error: 'type and payload are required' });
    return;
  }

  const jobId = generateJobId();

  // Idempotency: check if job with same payload exists and is completed
  const existing = await pool.query(
    `SELECT id, status, result FROM jobs 
     WHERE type = $1 AND payload = $2 AND status IN ('pending', 'processing', 'completed')
     LIMIT 1`,
    [type, JSON.stringify(payload)]
  );

  if (existing.rows.length > 0 && existing.rows[0].status === 'completed') {
    res.status(200).json({ job: existing.rows[0], cached: true });
    return;
  }

  await pool.query(
    `INSERT INTO jobs (id, type, payload, status) VALUES ($1, $2, $3, 'pending')`,
    [jobId, type, JSON.stringify(payload)]
  );

  if (type === 'video.transcode') {
    await addTranscodeJob({ jobId, ...payload });
  }

  res.status(202).json({ jobId, status: 'pending' });
});
```

### Worker with Progress

```typescript
// src/services/transcode.ts
import { spawn } from 'child_process';
import { pool } from '../db.js';
import { logger } from '../utils/logger.js';

export async function transcodeVideo(jobId: string, inputPath: string, formats: string[]) {
  const log = logger.child({ jobId, service: 'transcode' });
  const outputs: string[] = [];

  for (let i = 0; i < formats.length; i++) {
    const format = formats[i];
    const outputPath = `${inputPath}.${format}`;

    await pool.query(
      `UPDATE jobs SET progress = $1, updated_at = NOW() WHERE id = $2`,
      [Math.round(((i) / formats.length) * 100), jobId]
    );

    log.info({ format, progress: Math.round(((i) / formats.length) * 100) }, 'Transcoding format');
    await runFfmpeg(inputPath, outputPath, format);
    outputs.push(outputPath);

    await pool.query(
      `UPDATE jobs SET progress = $1, updated_at = NOW() WHERE id = $2`,
      [Math.round(((i + 1) / formats.length) * 100), jobId]
    );
  }

  return { outputs };
}

function runFfmpeg(input: string, output: string, format: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('sleep', ['0.1']);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}
```

## Decisions

**Queue: BullMQ vs Bee-Queue**
- Option A: Bee-Queue — simpler API, fewer features
- Option B: BullMQ — retries, delays, rate limiting, job schedulers
- **Chosen: B** — we need retries, DLQ, and progress tracking

**DLQ: BullMQ native vs custom**
- Option A: BullMQ `removeOnFail: false` + manual inspection
- Option B: Custom DLQ table in PostgreSQL
- **Chosen: A for now** — BullMQ keeps failed jobs in Redis; monitor with `bull-board`

## Checklist

- [ ] Redis is configured with persistence (AOF or RDB)
- [ ] BullMQ jobs have `attempts: 3` and exponential backoff
- [ ] Idempotency checks return cached results for duplicate payloads
- [ ] Worker progress is tracked in PostgreSQL
- [ ] DLQ is monitored (via `bull-board` or similar)
- [ ] Worker processes are separate from the API process
- [ ] Zombie processes are cleaned up on worker crash

## Post-Mortem: v7 Bugs

1. **No cleanup on crash** (fixed): Workers track spawned process PIDs and kill them on `SIGTERM`
2. **No idempotency** (fixed): `POST /jobs` checks for existing completed jobs before enqueuing
3. **Zombie processes** (fixed): `process.on('exit', cleanup)` kills lingering ffmpeg processes

## Your Turn

- What happens if Redis goes down while a job is processing?
- How would you implement job prioritization (e.g., VIP users first)?
- Should the worker pull from the queue or should the queue push to the worker?
