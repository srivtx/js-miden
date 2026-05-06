# Project 6: Distributed Job Queue

> "Users upload a video and wait. Minutes pass. Nothing happens. Did it work? Is it stuck? Did it fail? They upload again. And again. Now you have three jobs, two of which are duplicates, and your server is on fire."

---

## Section 1: The Brief (WHAT)

### Requirements Breakdown

A video platform needs to process every uploaded video through this pipeline:

1.  **Transcoding** - Convert source video to 1080p, 720p, and 480p MP4s
2.  **Thumbnail generation** - Extract a poster frame at 00:00:05
3.  **Audio extraction** - Rip AAC audio track for podcast RSS feed
4.  **Notification** - Email/push the user when everything is done
5.  **Failure handling** - Retry failed jobs 3 times with exponential backoff
6.  **Dead letter queue** - After 3 failures, park the job for human review
7.  **Throughput** - 1,000 videos/hour (about 0.28 videos/second sustained, bursty to 5-10/sec)
8.  **Progress visibility** - Real-time progress: "Uploading... Transcoding 1080p... 45%... Done"

### User Stories

- **As a user**, I want to see a progress bar after I upload, so I know whether to wait or grab coffee.
- **As a user**, I want to be notified when my video is ready, so I don't manually refresh for 10 minutes.
- **As an ops engineer**, I want failed jobs to retry automatically, so I don't get paged at 3am for a transient S3 blip.
- **As an ops engineer**, I want permanently failed jobs in a DLQ, so I can inspect corrupt files without losing them.
- **As a product manager**, I want paid users' videos processed first, so our revenue stream feels premium.

### Core Problem

**Async work is invisible, failure-prone, and hard to debug.**

When work moves out of the request/response cycle, you lose three things:
1.  **Visibility** - You can't see it in your HTTP logs. It vanishes into a black box.
2.  **Reliability** - Networks blip, disks fill up, codecs are weird. Failures are guaranteed.
3.  **Debugging** - When something breaks, you can't just `curl` it again. The state is somewhere else.

A job queue is not just "run this later." It is a distributed state machine with retries, observability, and failure domains.

---

## Section 2: Architecture (WHY)

```
                    +------------------+
                    |   User Uploads   |
                    +--------+---------+
                             |
                             v
                    +--------+---------+
                    |  Express API     |
                    |  (HTTP thread)   |
                    +--------+---------+
                             |  "Job created: #4821"
                             v
         +-------------------+-------------------+
         |                                       |
         v                                       v
  +-------------+                       +----------------+
  |  BullMQ     | <-- Redis Lists/ZSets |  PostgreSQL    |
  |  Queues     |    (job state)        |  (videos table)|
  +-------------+                       +----------------+
         |
    +----+----+----+----+
    |         |         |
    v         v         v
+-------+ +-------+ +-------+
| Trans | | Thumb | | Audio |
| coder | | nailer| | Ripper|
+---+---+ +---+---+ +---+---+
    |         |         |
    v         v         v
+----------------------------------+
|         Dead Letter Queue        |
|    (permanent failures, human)   |
+----------------------------------+
    |
    v
+----------------------------------+
|   SSE Stream / Dashboard API     |
|   (progress, status, retry)      |
+----------------------------------+
```

### Why BullMQ over raw Redis?

Raw Redis gives you `LPUSH` and `BRPOP`. That's it. You still have to build:
- Job IDs and deduplication
- Retry logic with backoff
- Delayed jobs (`process this at 2am`)
- Job priorities
- Progress tracking
- Stalled job detection (what if a worker dies mid-job?)
- Atomic state transitions

BullMQ is a thin, battle-hardened layer over Redis that gives you all of this. It uses Redis Streams (BullMQ 5) for persistence and Lua scripts for atomicity.

**WHAT IF WRONG:** You build your own queue in 2 weeks. It works in staging. In production, a worker dies during a job, the job is lost forever, and you spend a month debugging why 3% of videos never finish. Use the library.

### Why Separate Job Types?

Transcoding, thumbnailing, and audio extraction are **independent** and have **different resource profiles**:

| Job Type | CPU | Memory | Duration | Can Parallelize |
|----------|-----|--------|----------|-----------------|
| Transcode | Heavy | High | 2-10 min | No (within one video) |
| Thumbnail | Light | Low | 2-5 sec | Yes |
| Audio rip | Medium | Low | 30-60 sec | Yes |

If you put them in one queue with one worker type, your thumbnail jobs wait behind a 10-minute transcode. Separate queues let you scale workers independently: 10 transcoding workers, 20 thumbnail workers, 5 audio workers.

**WHAT IF WRONG:** One slow job type congests the entire pipeline. Thumbnails that should take 2 seconds wait 5 minutes. Users see "Processing..." forever.

### Why NOT Process in the Request Cycle?

HTTP requests have timeouts. Browser: 30-120 seconds. Load balancer: 60 seconds. Lambda: 29 seconds (API Gateway). A 4K transcode takes 5-10 minutes.

If you process in the request:
1. The connection drops. The user sees an error. But the transcode is still running.
2. The user uploads again. Now you have two transcoding jobs.
3. Your server thread is blocked. Node.js is single-threaded. No one else can upload.

**WHAT IF WRONG:** Your API becomes unresponsive during peak upload. Users get 502 Bad Gateway. You scale your API servers horizontally, burning cash, when the bottleneck is CPU-bound video work that should be on separate workers.

### Why a Dead Letter Queue?

Some failures are transient (S3 503, network blip). Retry fixes those. Some failures are permanent (corrupt file, unsupported codec, missing metadata). Retrying a corrupt file 1,000 times costs CPU, storage, and money.

The DLQ is a holding pen for permanent failures. A human inspects the file, decides "re-encode with different settings" or "reject and email user," and either re-queues or deletes.

**WHAT IF WRONG:** You retry forever. Your cloud bill explodes. Or you drop failures silently. Users wonder why their video never appeared. Your support inbox drowns.

### Why Job Progress Tracking?

Without progress, the user sees "Processing..." for 8 minutes. They refresh. They re-upload. Now you have duplicates.

With progress:
- **UX:** Users know it's working.
- **Debugging:** If progress stalls at "Transcoding 720p 12%," you know exactly which step failed.
- **Observability:** You can alert if average progress velocity drops (queue backup).

**WHAT IF WRONG:** Support tickets spike. Users treat your platform as unreliable. You have no telemetry to distinguish "slow" from "stuck."

### Why Idempotency?

Networks are unreliable. A worker finishes a transcode, tries to mark the job "completed," and the Redis connection blips. BullMQ retries the job. Without idempotency, you transcode the video again.

Idempotency means: running the job N times produces the same result as running it once. Check if the output file exists before starting ffmpeg.

**WHAT IF WRONG:** You re-transcode the same video 3 times. Storage costs triple. Progress notifications fire twice. The database ends up with duplicate rows.

---

## Section 3: NEW Concepts (Inline Teaching)

### 3.1 BullMQ Advanced Patterns

**WHAT:** BullMQ 5 supports priorities, delayed jobs, repeatable jobs (cron), and rate limiting.

**WHY HERE:** Paid users get priority 1. Free users get priority 5. Transcodes scheduled for off-peak get delayed. Rate limiting prevents ffmpeg from melting your CPU.

**WHAT HAPPENS IF WE DON'T:** All jobs are FIFO. A batch upload of 500 free-tier videos blocks your one enterprise customer for an hour. They churn.

```typescript
// producer.ts
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const redis = new IORedis({ maxRetriesPerRequest: null });

export const videoQueue = new Queue('video-transcode', { connection: redis });

await videoQueue.add(
  'transcode',
  { videoId: 'vid_4821', formats: ['1080p', '720p', '480p'] },
  {
    priority: user.isPaid ? 1 : 5,           // paid first
    delay: user.scheduleForLater ? 3600000 : 0, // 1 hour delay
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,  // keep last 100 completed jobs
    removeOnFail: 50,       // keep last 50 failed jobs
  }
);
```

### 3.2 Dead Letter Queues (DLQ)

**WHAT:** A secondary queue where permanently failed jobs land after exhausting all retries. Think of it as a hospital triage for jobs that need human diagnosis.

**WHY HERE:** A video with a corrupt MOOV atom will fail ffmpeg every time. A human needs to either repair it or notify the user.

**WHAT HAPPENS IF WE DON'T:** Failed jobs accumulate in the main queue or get dropped. You lose track of broken uploads. Users complain. You have no audit trail.

```typescript
// dlq.ts
import { Queue, Worker } from 'bullmq';

const dlq = new Queue('video-dlq', { connection: redis });

// SECURITY FIX C1 + C2: Never pass onFailed as a constructor option.
// Attach event listeners to the EXISTING worker instance instead of creating a ghost worker.
const transcodeWorker = new Worker('video-transcode', async (job) => {
  // ... processor logic ...
}, {
  connection: redis,
  // No onFailed here — this is not valid BullMQ 5 API
});

// Correct BullMQ 5 API: use worker.on('failed', ...) after construction
transcodeWorker.on('failed', async (job, err) => {
  if (!job) return;
  if (job.attemptsMade >= (job.opts.attempts || 3)) {
    await dlq.add('dlq-item', {
      originalJobId: job.id,
      videoId: job.data.videoId,
      error: err.message,
      failedAt: new Date().toISOString(),
      payload: job.data,
    });
    console.error(`Job ${job.id} moved to DLQ`);
  }
});

// DLQ monitoring endpoint (see Section 4.10 for auth)
app.get('/admin/dlq', async (_req, res) => {
  const jobs = await dlq.getJobs(['waiting', 'delayed'], 0, 100);
  res.json(jobs.map(j => ({
    id: j.id,
    videoId: j.data.videoId,
    error: j.data.error,
    failedAt: j.data.failedAt,
  })));
});
```

> **EDUCATIONAL NOTE:** `onFailed` is an **event**, not a constructor option in BullMQ 5. Passing it in the constructor does nothing. Worse, creating a second `Worker` just to listen for failures creates a "ghost worker" that competes for jobs, causing duplicate processing (Critical Fixes C1, C2).

### 3.3 Exponential Backoff with Jitter

**WHAT:** Instead of retrying every 5 seconds (linear), wait 5s, then 10s, then 20s. Add random jitter (+/- 20%) so all failing jobs don't retry simultaneously.

**WHY HERE:** If S3 has a 30-second blip, immediate retries hammer it harder. Exponential backoff gives the service time to recover. Jitter prevents the "thundering herd" where 1,000 jobs all retry at t=20s and DDoS your storage.

**WHAT HAPPENS IF WE DON'T:** Linear backoff = 3 retries in 15 seconds. Not enough time for S3 to recover. No jitter = all retries align, creating traffic spikes that cause more failures. Infinite loop of failure.

```typescript
// backoff.ts
function calculateBackoff(attempt: number, baseDelayMs: number = 5000): number {
  const exponential = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = exponential * 0.2 * (Math.random() * 2 - 1); // +/- 20%
  return Math.min(exponential + jitter, 300000); // cap at 5 min
}

// BullMQ handles this natively, but here's the math visualized:
// Attempt 1: ~5s
// Attempt 2: ~10s (+/- 2s jitter)
// Attempt 3: ~20s (+/- 4s jitter)
```

### 3.4 Job Observability

**WHAT:** Event listeners on queues and workers that emit metrics, logs, and dashboard data.

**WHY HERE:** You need to know queue depth, processing rate, error rate, and which jobs are stalled. Without this, you're flying blind.

**WHAT HAPPENS IF WE DON'T:** You find out about a queue backup when users tweet about it. You find out about a worker crash when your backlog hits 10,000 jobs.

```typescript
// observability.ts
import { QueueEvents } from 'bullmq';

const queueEvents = new QueueEvents('video-transcode', { connection: redis });

queueEvents.on('completed', ({ jobId }) => {
  console.log(`[METRIC] job_completed{queue="video-transcode"} 1`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.log(`[METRIC] job_failed{queue="video-transcode",reason="${failedReason}"} 1`);
});

queueEvents.on('stalled', ({ jobId }) => {
  console.error(`[ALERT] Job ${jobId} stalled! Worker may have crashed.`);
});

// Prometheus-style metrics endpoint
app.get('/metrics', async (_req, res) => {
  const transcodeWaiting = await videoQueue.getWaitingCount();
  const transcodeActive = await videoQueue.getActiveCount();
  const transcodeFailed = await videoQueue.getFailedCount();

  res.set('Content-Type', 'text/plain');
  res.send(`
# HELP queue_waiting Number of jobs waiting in the queue
# TYPE queue_waiting gauge
queue_waiting{queue="video-transcode"} ${transcodeWaiting}
# HELP queue_active Number of active jobs in the queue
# TYPE queue_active gauge
queue_active{queue="video-transcode"} ${transcodeActive}
# HELP queue_failed Number of failed jobs in the queue
# TYPE queue_failed gauge
queue_failed{queue="video-transcode"} ${transcodeFailed}
  `.trim());
});
```

### 3.5 Worker Pools and Concurrency

**WHAT:** Running multiple worker processes, each handling N concurrent jobs. For CPU-bound work like ffmpeg, you often want concurrency=1 per worker and scale by adding worker processes.

**WHY HERE:** Node.js is single-threaded. Two ffmpeg processes on one core will fight. Better: one ffmpeg per worker, 4 workers per machine, each pinned to a CPU core.

**WHAT HAPPENS IF WE DON'T:** You set concurrency=10 on a 2-core machine. All ffmpeg processes thrash. Context switching overhead makes everything slower than sequential processing.

```typescript
// worker.ts
import { Worker } from 'bullmq';
import os from 'os';

// CPU affinity: pin this worker to core 2
// (Linux only; on macOS/Windows this is a no-op but harmless)
if (process.env.WORKER_CPU_AFFINITY) {
  try {
    os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);
  } catch { /* ignore on unsupported platforms */ }
}

const worker = new Worker('video-transcode', async (job) => {
  await transcodeVideo(job.data);
}, {
  connection: redis,
  concurrency: 1, // one ffmpeg at a time per worker
  limiter: {
    max: 10,      // 10 jobs
    duration: 60000, // per minute (rate limit)
  },
});

// To scale: run 4 instances of this worker container
// Docker Compose will handle replication
```

### 3.6 Temporal / Inngest Concept

**WHAT:** Workflow engines (Temporal, Inngest, AWS Step Functions) orchestrate multi-step workflows with durable execution. If step 3 of 7 crashes, they resume from step 3, not the beginning.

**WHY MENTION IT:** Our video pipeline is simple: three independent jobs + notification. A queue is perfect. But if you add "transcode -> if 1080p succeeds, generate HDR version -> if HDR succeeds, notify premium users -> else notify standard users," you have a workflow graph. Queues alone get messy.

**WHEN TO USE WHAT:**
- **Queue (BullMQ):** Simple, independent, fire-and-forget jobs. High throughput. You manage state.
- **Workflow engine (Temporal):** Complex, conditional, multi-step processes with human-in-the-loop. Lower throughput, higher coordination.

**WHAT HAPPENS IF WE DON'T (and pick wrong):** You implement a saga in BullMQ by chaining job completions to new job additions. It works until you need "wait for user approval before step 5." You build a state machine in Redis. You have reinvented Temporal, badly.

```typescript
// Simple "workflow" in BullMQ (fine for 3 steps)
// Temporal would handle this with actual workflow code that survives server restarts
async function notifyOnCompletion(videoId: string) {
  // Wait for all three job types to finish using BullMQ job dependencies
  // (BullMQ supports parent/child jobs in v5)
  await parentQueue.add('notify-parent', { videoId }, {
    children: [
      { name: 'transcode', data: { videoId }, queue: 'video-transcode' },
      { name: 'thumbnail', data: { videoId }, queue: 'video-thumbnail' },
      { name: 'audio', data: { videoId }, queue: 'video-audio' },
    ],
  });
}
```

### 3.7 Saga Pattern

**WHAT:** In distributed systems, a "transaction" spans multiple services. The Saga pattern manages failure by running **compensating transactions** (undo operations).

**WHY HERE:** If thumbnail and audio succeed but transcode fails, do we keep the thumbnail? If the user re-uploads, we might regenerate everything. But if we billed them per-processed-minute, we need to refund the failed transcode.

**WHAT HAPPENS IF WE DON'T:** Partial failures leave your system inconsistent. The database says "ready" but the 1080p file is missing. The user gets a notification with a broken link.

```typescript
// saga.ts
class VideoProcessingSaga {
  async execute(videoId: string) {
    const steps: Array<{ do: () => Promise<void>; undo: () => Promise<void> }> = [
      {
        do: () => transcode(videoId),
        undo: () => deleteTranscodes(videoId),
      },
      {
        do: () => generateThumbnail(videoId),
        undo: () => deleteThumbnail(videoId),
      },
      {
        do: () => extractAudio(videoId),
        undo: () => deleteAudio(videoId),
      },
    ];

    const completed: Array<() => Promise<void>> = [];

    for (const step of steps) {
      try {
        await step.do();
        completed.push(step.undo);
      } catch (err) {
        // MAJOR FIX M7: Compensation retries with exponential backoff and alerting
        for (const undo of completed.reverse()) {
          let success = false;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              await undo();
              success = true;
              break;
            } catch (rollbackErr) {
              console.error(`Rollback attempt ${attempt} failed:`, rollbackErr);
              await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
            }
          }
          if (!success) {
            // Alert human: manual cleanup needed after compensation failure
            await alertOps(`Saga compensation failed for video ${videoId}`);
          }
        }
        throw new Error(`Saga failed, rolled back ${completed.length} steps: ${err}`);
      }
    }
  }
}

async function alertOps(message: string) {
  // Integrate with PagerDuty, Slack, or email
  console.error(`[OPS ALERT] ${message}`);
}
```

> **EDUCATIONAL NOTE:** The original saga ran undo functions but if `deleteTranscodes()` failed (e.g., file locked by ffmpeg), it just logged and continued. The system was left in an inconsistent state with partial files. We now retry compensations with exponential backoff and alert a human if they still fail (Major Fix M7).

---

## Section 4: Step-by-Step Build Guide

### Prerequisites

```bash
# 2025 stack
pnpm init
pnpm add express@5 bullmq@5 ioredis pg zod dotenv
pnpm add -D typescript @types/express @types/node tsx
```

### 4.1 Database Schema

```sql
-- schema.sql
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  original_url TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE video_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  type VARCHAR(20) CHECK (type IN ('1080p','720p','480p','thumbnail','audio')),
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(video_id, type)  -- idempotency key
);

CREATE TABLE job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  queue TEXT NOT NULL,
  video_id UUID NOT NULL,
  event VARCHAR(20) CHECK (event IN ('started','progress','completed','failed','retried')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_videos_user ON videos(user_id);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_job_logs_job ON job_logs(job_id);
```

**WHY `video_outputs` unique constraint:** Prevents duplicate outputs if a job retries. `video_id + type` is the natural idempotency key.

### 4.2 BullMQ Setup with Redis

```typescript
// lib/queues.ts
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { spawn } from 'child_process';

export const redis = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null, // BullMQ requirement
});

export const transcodeQueue = new Queue('video-transcode', { connection: redis });
export const thumbnailQueue = new Queue('video-thumbnail', { connection: redis });
export const audioQueue = new Queue('video-audio', { connection: redis });
export const dlq = new Queue('video-dlq', { connection: redis });

// MAJOR FIX M9: Track active child processes for cleanup on shutdown
export const activeProcesses = new Set<ReturnType<typeof spawn>>();

// MAJOR FIX M9: Graceful shutdown must also kill active child processes
async function closeQueues() {
  // Kill any active ffmpeg simulations so they don't become zombies
  for (const proc of activeProcesses) {
    if (!proc.killed) proc.kill('SIGKILL');
  }
  activeProcesses.clear();

  await Promise.all([
    transcodeQueue.close(),
    thumbnailQueue.close(),
    audioQueue.close(),
    dlq.close(),
    redis.quit(),
  ]);
}

process.on('SIGTERM', closeQueues);
process.on('SIGINT', closeQueues);
```

> **EDUCATIONAL NOTE:** The original graceful shutdown handler closed BullMQ queues and Redis, but did not terminate active ffmpeg processes. On SIGTERM, running jobs are killed mid-process, leaving corrupt output files that pass the idempotency check on retry. We now track active child processes in a global `Set` and kill them during shutdown (Major Fix M9).

**WHY `maxRetriesPerRequest: null`:** BullMQ manages its own retries at the job level. If ioredis retries a command, it can corrupt BullMQ's atomic Lua scripts.

### 4.3 Job Producers (Upload Triggers Jobs)

```typescript
// routes/upload.ts
import { Router } from 'express';
import { transcodeQueue, thumbnailQueue, audioQueue } from '../lib/queues.js';
import { db } from '../lib/db.js';
import { z } from 'zod';

// SECURITY FIX C5: Zod validation with file type whitelist and size limits
const UploadSchema = z.object({
  userId: z.string().uuid(),
  originalUrl: z.string().url().refine((url) => {
    const allowed = ['.mp4', '.mov', '.webm', '.mkv'];
    return allowed.some((ext) => url.toLowerCase().endsWith(ext));
  }, { message: 'Invalid video file extension' }),
  isPaid: z.boolean().optional(),
  fileSizeBytes: z.number().int().max(10 * 1024 * 1024 * 1024).optional(), // 10GB max
});

export const uploadRouter = Router();

uploadRouter.post('/', async (req, res) => {
  const parse = UploadSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: 'Invalid input', details: parse.error.issues });
  }
  const { userId, originalUrl, isPaid } = parse.data;

  const video = await db.query(
    'INSERT INTO videos (user_id, original_url) VALUES ($1, $2) RETURNING *',
    [userId, originalUrl]
  );

  const videoId = video.rows[0].id;

  // MAJOR FIX M2 + M3: Handle partial failures and use deterministic job IDs for deduplication
  const results = await Promise.allSettled([
    transcodeQueue.add('transcode', { videoId, originalUrl }, {
      jobId: `${videoId}:transcode`, // MAJOR FIX M3: Deterministic job ID prevents duplicates
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      priority: isPaid ? 1 : 5,
      timeout: 600000, // MAJOR FIX M1: 10 minute job timeout
    }),
    thumbnailQueue.add('thumbnail', { videoId, originalUrl }, {
      jobId: `${videoId}:thumbnail`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      timeout: 60000,
    }),
    audioQueue.add('audio', { videoId, originalUrl }, {
      jobId: `${videoId}:audio`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      timeout: 300000,
    }),
  ]);

  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failures.length > 0) {
    console.error('Queue add failures:', failures.map((f) => f.reason));
    // Log inconsistency; a transactional outbox pattern would be ideal here
  }

  res.status(202).json({ videoId, status: 'pending', queued: results.length - failures.length });
});
```

> **EDUCATIONAL NOTE:** We added Zod validation with URL format checks, UUID validation, file extension whitelist, and a 10GB size limit so malformed input never reaches the database or ffmpeg (Critical Fix C5). We switched from `Promise.all` to `Promise.allSettled` so one queue failure doesn't silently lose the others (Major Fix M2). We added deterministic `jobId` values so double-clicks or retries don't flood the queue with duplicates (Major Fix M3). We also added `timeout` to prevent hung ffmpeg processes from blocking workers forever (Major Fix M1).

**WHY 202 Accepted:** The upload is received. The work is queued. We are not waiting for it to finish. This is the correct HTTP semantic for async work.

### 4.4 Worker: Video Transcoding

```typescript
// lib/db.ts
// MAJOR FIX M5: Explicit database configuration with connection pooling
import { Pool } from 'pg';

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,              // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Verify connectivity on startup
db.query('SELECT 1').then(() => console.log('Database connected')).catch((err) => {
  console.error('Database connection failed:', err);
  process.exit(1);
});
```

```typescript
// workers/transcode.ts
import { Worker } from 'bullmq';
import { spawn } from 'child_process';
import { redis, activeProcesses } from '../lib/queues.js';
import { db } from '../lib/db.js';

const worker = new Worker('video-transcode', async (job) => {
  // SECURITY FIX C4: Cleanup ffmpeg in finally block; kill on timeout
  const { videoId, originalUrl } = job.data;
  const formats = ['1080p', '720p', '480p'];

  // IDEMPOTENCY CHECK
  const existing = await db.query(
    'SELECT type FROM video_outputs WHERE video_id = $1',
    [videoId]
  );
  const doneFormats = new Set(existing.rows.map(r => r.type));

  await logEvent(job.id!, 'video-transcode', videoId, 'started');

  let completedFormats = 0;

  try {
    for (const format of formats) {
      if (doneFormats.has(format)) {
        completedFormats++;
        await job.updateProgress(Math.round((completedFormats / formats.length) * 100));
        continue;
      }

      const outputPath = `/storage/${videoId}_${format}.mp4`;

      // Simulate ffmpeg (replace with real spawn)
      await runFfmpeg(originalUrl, outputPath, format, job, completedFormats, formats.length);

      await db.query(
        'INSERT INTO video_outputs (video_id, type, url) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [videoId, format, outputPath]
      );

      completedFormats++;
      await job.updateProgress(Math.round((completedFormats / formats.length) * 100));
    }

    await logEvent(job.id!, 'video-transcode', videoId, 'completed');
    return { videoId, formatsDone: formats };
  } catch (err) {
    await logEvent(job.id!, 'video-transcode', videoId, 'failed', { error: (err as Error).message });
    throw err;
  } finally {
    // SECURITY FIX C4: Kill any lingering child processes so they don't become zombies
    for (const proc of activeProcesses) {
      if (!proc.killed) {
        proc.kill('SIGKILL');
      }
    }
    activeProcesses.clear();
  }
}, {
  connection: redis,
  concurrency: 1, // ffmpeg is CPU-bound
  lockDuration: 30000,
  stalledInterval: 30000,
  maxStalledCount: 2,
});

// SECURITY FIX C6: Track active child processes for cleanup on worker crash
const activeProcesses = new Set<ReturnType<typeof spawn>>();

function runFfmpeg(
  input: string, output: string, format: string,
  job: any, completed: number, total: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    // SECURITY FIX C6: NEVER use spawn('sh', ['-c', ...]) with user input.
    // Always pass arguments as an array so the OS treats them as data, not commands.
    // Simulation only — replace with real ffmpeg spawn in production:
    const proc = spawn('sh', ['-c', `sleep 2 && echo "done ${format}"`]); // SIMULATION ONLY

    activeProcesses.add(proc);

    proc.on('error', reject);
    proc.on('close', (code) => {
      activeProcesses.delete(proc);
      if (code !== 0) reject(new Error(`ffmpeg exited ${code}`));
      else resolve();
    });

    // SECURITY FIX C3: Replace setInterval(async ...) with a proper async loop
    // setInterval with async callbacks swallows rejections and creates overlapping calls.
    let running = true;
    async function progressLoop() {
      while (running) {
        try {
          await new Promise((r) => setTimeout(r, 500));
          if (!running) break;
          const pseudoProgress = Math.min(95, Math.random() * 100);
          const overall = Math.round(((completed + (pseudoProgress / 100)) / total) * 100);
          await job.updateProgress(overall);
        } catch (err) {
          console.error('Progress update failed:', err);
          // Continue; don't let progress errors kill the transcode
        }
      }
    }
    progressLoop();

    proc.on('close', () => { running = false; });
  });
}

async function updateVideoStatus(videoId: string, status: string) {
  // MAJOR FIX M4: If multiple workers run, they race on the videos.progress column.
  // In production, remove `progress` from the `videos` table and compute it from
  // job states or `job_logs` on read. For now, we keep status updates minimal.
  await db.query('UPDATE videos SET status = $1, updated_at = NOW() WHERE id = $2', [status, videoId]);
}

async function logEvent(jobId: string, queue: string, videoId: string, event: string, metadata?: object) {
  await db.query(
    'INSERT INTO job_logs (job_id, queue, video_id, event, metadata) VALUES ($1, $2, $3, $4, $5)',
    // MAJOR FIX M6: Pass the object directly; pg handles JSONB natively.
    // Stringifying may cause double-quoting depending on driver version.
    [jobId, queue, videoId, event, metadata || null]
  );
}

export default worker;
```

### 4.5 Worker: Thumbnail Generation

```typescript
// src/health.ts
// MAJOR FIX M8: Health check endpoints for Docker/Kubernetes
import { Router } from 'express';
import { redis } from './lib/queues.js';
import { db } from './lib/db.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  try {
    await redis.ping();
    await db.query('SELECT 1');
    res.status(200).json({ status: 'ok', redis: 'up', db: 'up' });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: (err as Error).message });
  }
});
```

```typescript
// workers/thumbnail.ts
import { Worker } from 'bullmq';
import { spawn } from 'child_process';
import { redis, activeProcesses } from '../lib/queues.js';
import { db } from '../lib/db.js';

const worker = new Worker('video-thumbnail', async (job) => {
  const { videoId, originalUrl } = job.data;

  // IDEMPOTENCY
  const existing = await db.query(
    'SELECT 1 FROM video_outputs WHERE video_id = $1 AND type = $2',
    [videoId, 'thumbnail']
  );
  if (existing.rows.length > 0) {
    return { cached: true };
  }

  const outputPath = `/storage/${videoId}_thumb.jpg`;

  // ffmpeg -ss 00:00:05 -i input.mp4 -vframes 1 output.jpg
  const proc = spawn('sh', ['-c', `sleep 1 && echo "thumb done"`]); // SIMULATION ONLY
  activeProcesses.add(proc);

  try {
    await new Promise<void>((resolve, reject) => {
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code !== 0) reject(new Error(`thumbnail failed: ${code}`));
        else resolve();
      });
    });

    await db.query(
      'INSERT INTO video_outputs (video_id, type, url) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [videoId, 'thumbnail', outputPath]
    );

    return { videoId, thumbnailUrl: outputPath };
  } finally {
    activeProcesses.delete(proc);
    if (!proc.killed) proc.kill('SIGKILL');
  }
}, { connection: redis, concurrency: 5 }); // thumbnails are fast, allow more concurrency

export default worker;
```

### 4.6 Worker: Audio Extraction

```typescript
// workers/audio.ts
import { Worker } from 'bullmq';
import { spawn } from 'child_process';
import { redis, activeProcesses } from '../lib/queues.js';
import { db } from '../lib/db.js';

const worker = new Worker('video-audio', async (job) => {
  const { videoId, originalUrl } = job.data;

  const existing = await db.query(
    'SELECT 1 FROM video_outputs WHERE video_id = $1 AND type = $2',
    [videoId, 'audio']
  );
  if (existing.rows.length > 0) return { cached: true };

  const outputPath = `/storage/${videoId}.aac`;

  // ffmpeg -i input.mp4 -vn -c:a copy output.aac
  const proc = spawn('sh', ['-c', `sleep 1.5 && echo "audio done"`]); // SIMULATION ONLY
  activeProcesses.add(proc);

  try {
    await new Promise<void>((resolve, reject) => {
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code !== 0) reject(new Error(`audio extraction failed: ${code}`));
        else resolve();
      });
    });

    await db.query(
      'INSERT INTO video_outputs (video_id, type, url) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [videoId, 'audio', outputPath]
    );

    return { videoId, audioUrl: outputPath };
  } finally {
    activeProcesses.delete(proc);
    if (!proc.killed) proc.kill('SIGKILL');
  }
}, { connection: redis, concurrency: 2 });

export default worker;
```

### 4.7 Retry Logic with Exponential Backoff + Jitter

BullMQ handles this natively. We configured it in the producer:

```typescript
backoff: { type: 'exponential', delay: 5000 }
```

BullMQ 5's exponential backoff already includes jitter internally to prevent thundering herd. If you need custom backoff:

```typescript
backoff: {
  type: 'custom',
  delay: 5000,
}

// In worker options:
const worker = new Worker('video-transcode', processor, {
  connection: redis,
  settings: {
    backoffStrategy: (attemptsMade: number) => {
      const base = 5000 * Math.pow(2, attemptsMade - 1);
      const jitter = base * 0.2 * Math.random();
      return Math.min(base + jitter, 300000);
    },
  },
});
```

**WHY cap at 5 minutes:** Without a cap, attempt 10 waits 5,000+ seconds. The user uploaded 3 hours ago. They don't care anymore.

### 4.8 Dead Letter Queue Handler

```typescript
// workers/dlq-monitor.ts
import { Worker } from 'bullmq';
import { redis, dlq } from '../lib/queues.js';

// Move permanently failed jobs to DLQ
const transcodeWorker = new Worker('video-transcode', async (job) => { ... }, {
  connection: redis,
});

transcodeWorker.on('failed', async (job, err) => {
  if (!job) return;
  if (job.attemptsMade >= (job.opts.attempts || 3)) {
    await dlq.add('failed-transcode', {
      originalJobId: job.id,
      videoId: job.data.videoId,
      error: err.message,
      stack: err.stack,
      failedAt: new Date().toISOString(),
    }, {
      attempts: 1, // DLQ jobs don't retry automatically
    });

    // Alert ops
    console.error(`[DLQ ALERT] Video ${job.data.videoId} permanently failed: ${err.message}`);
  }
});

// Admin: reprocess a DLQ job
export async function reprocessDlqJob(dlqJobId: string) {
  const dlqJob = await dlq.getJob(dlqJobId);
  if (!dlqJob) throw new Error('DLQ job not found');

  const { videoId, originalUrl } = dlqJob.data.payload;

  // Re-queue to original queue
  await transcodeQueue.add('transcode', { videoId, originalUrl }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });

  await dlqJob.remove();
  return { requeued: true };
}
```

### 4.9 Progress Tracking (SSE to Client)

```typescript
// routes/progress.ts
import { Router } from 'express';
import { redis } from '../lib/queues.js';
import { db } from '../lib/db.js';

export const progressRouter = Router();

progressRouter.get('/:videoId', async (req, res) => {
  const { videoId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // MAJOR FIX M4: Compute aggregate progress from job states instead of racing on videos.progress
  const video = await db.query('SELECT status FROM videos WHERE id = $1', [videoId]);
  const baseStatus = video.rows[0] || { status: 'unknown' };

  async function computeProgress() {
    const jobs = await transcodeQueue.getJobs(['active', 'waiting', 'completed', 'failed']);
    const videoJobs = jobs.filter((j: any) => j.data.videoId === videoId);
    if (videoJobs.length === 0) return { status: baseStatus.status, progress: 0 };
    const avgProgress = videoJobs.reduce((sum: number, j: any) => sum + (j.progress || 0), 0) / videoJobs.length;
    return { status: baseStatus.status, progress: Math.round(avgProgress) };
  }

  const initial = await computeProgress();
  res.write(`data: ${JSON.stringify(initial)}\n\n`);

  // SECURITY FIX C7: Always unsubscribe and quit subscriber, even on errors
  const subscriber = redis.duplicate();
  let cleanedUp = false;

  async function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    try {
      await subscriber.unsubscribe(`video:${videoId}:progress`);
    } catch { /* ignore */ }
    try {
      await subscriber.quit();
    } catch { /* ignore */ }
  }

  try {
    await subscriber.subscribe(`video:${videoId}:progress`);

    subscriber.on('message', async (_channel, message) => {
      // Merge real-time Redis message with computed aggregate
      const computed = await computeProgress();
      res.write(`data: ${JSON.stringify({ ...computed, ...JSON.parse(message) })}\n\n`);
    });

    subscriber.on('error', async (err) => {
      console.error('Redis subscriber error:', err);
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Progress stream error' })}\n\n`);
      await cleanup();
      res.end();
    });

    req.on('close', cleanup);
    req.on('error', cleanup);
  } catch (err) {
    console.error('Failed to subscribe to progress:', err);
    await cleanup();
    res.end();
  }
});
```

> **EDUCATIONAL NOTE:** We replaced the direct `videos.progress` read with an on-the-fly computation from BullMQ job states. This fixes the race condition where two workers overwrite each other's progress values (Major Fix M4).

> **EDUCATIONAL NOTE:** The original code didn't handle `subscriber.subscribe()` throwing (e.g., if Redis is down), which would crash the request. It also didn't robustly clean up the subscriber if the client disconnected before `req.on('close')` fired. We wrapped subscription in `try/catch`, added an `error` listener to the subscriber, and used a `cleanup` guard to prevent duplicate quit attempts (Critical Fix C7).

In the worker, publish progress:

```typescript
// Inside transcode worker, after updateProgress:
await redis.publish(`video:${videoId}:progress`, JSON.stringify({
  status: 'processing',
  progress: overall,
  step: format,
}));
```

**WHY SSE over WebSockets:** SSE is unidirectional (server -> client), works over HTTP/1.1, auto-reconnects, and requires no special protocol handshake. Perfect for progress bars.

### 4.10 Job Dashboard Endpoint

```typescript
// routes/dashboard.ts
import { Router } from 'express';
import { transcodeQueue, thumbnailQueue, audioQueue, dlq } from '../lib/queues.js';

// SECURITY FIX C8: Admin endpoints must be authenticated and authorized
function requireAdmin(req: any, res: any, next: any) {
  const adminKey = req.headers['x-admin-api-key'];
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

export const dashboardRouter = Router();
dashboardRouter.use(requireAdmin);

dashboardRouter.get('/', async (_req, res) => {
  const [transcode, thumbnail, audio, dlqJobs] = await Promise.all([
    getQueueStats(transcodeQueue),
    getQueueStats(thumbnailQueue),
    getQueueStats(audioQueue),
    dlq.getJobs(['waiting'], 0, 50),
  ]);

  res.json({
    queues: { transcode, thumbnail, audio },
    dlq: dlqJobs.map(j => ({
      id: j.id,
      videoId: j.data.videoId,
      error: j.data.error,
      failedAt: j.data.failedAt,
    })),
  });
});

async function getQueueStats(queue: any) {
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}

dashboardRouter.post('/retry/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const job = await transcodeQueue.getJob(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  await job.retry();
  res.json({ retried: true });
});
```

> **EDUCATIONAL NOTE:** The original dashboard and retry endpoints were completely unauthenticated. Any internet user could inspect failed jobs, retry them, and potentially re-trigger expensive or dangerous work. We added `requireAdmin` middleware that checks an `ADMIN_API_KEY` header before allowing access (Critical Fix C8).

---

## Section 5: 5 Intentional Bugs

### Bug 1: No Idempotency

**How to Introduce:** Remove the `ON CONFLICT DO NOTHING` and the `existing` check. Always insert and always run ffmpeg.

**Symptoms:** Duplicate rows in `video_outputs`. Files overwritten but processing time doubled. SSE progress bounces around.

**Reproduction:**
1. Upload a video.
2. Kill the Redis connection mid-transcode.
3. BullMQ retries. The job re-runs from the beginning.
4. Check `video_outputs` - two rows for `1080p`.

**Fix:**
```typescript
// Check output existence before processing
const existing = await db.query('SELECT type FROM video_outputs WHERE video_id = $1', [videoId]);
if (existing.rows.some(r => r.type === format)) continue;

// Use UPSERT
INSERT ... ON CONFLICT (video_id, type) DO NOTHING
```

**WHY:** Distributed systems guarantee at-least-once delivery. BullMQ may retry. Your code must be idempotent.

### Bug 2: Memory Leak in Workers

**How to Introduce:** Spawn ffmpeg but don't kill it if the job fails.

```typescript
// BROKEN - no cleanup
const proc = spawn('ffmpeg', [...]);
proc.on('close', (code) => {
  if (code !== 0) reject(new Error('fail'));
  resolve();
});
// If job times out or throws, proc keeps running
```

**Symptoms:** Worker memory grows over hours. `ps aux | grep ffmpeg` shows 50 zombie processes. Eventually the container OOMKills.

**Reproduction:**
1. Start worker.
2. Upload 100 videos.
3. Randomly make 20% fail (e.g., invalid URL).
4. Watch process count with `ps`.

**Fix:**
```typescript
let proc: ReturnType<typeof spawn> | null = null;

try {
  proc = spawn('ffmpeg', ['-i', input, '-vf', scale, '-c:a', 'copy', output], {
    detached: false, // Keep ffmpeg in the same process group so it dies with Node
  });
  // ... handle proc ...
} finally {
  if (proc && !proc.killed) {
    proc.kill('SIGKILL');
    // On Linux: process.kill(-proc.pid!, 'SIGKILL') to kill the entire process group
  }
}
```

**WHY:** Node.js garbage collection won't collect the ChildProcess object if it's still running. Even if the Promise rejects, the OS process lives until ffmpeg finishes. Using `detached: false` keeps the child in the same process group, so if the Node.js process crashes, the OS may clean it up. For absolute safety, also track active processes in a global Set and kill them on `SIGTERM` (see `lib/queues.ts` graceful shutdown).

### Bug 3: No Backoff

**How to Introduce:** Set `backoff: { type: 'fixed', delay: 1000 }` or omit backoff entirely.

**Symptoms:** A failing job retries 3 times in 3 seconds. If the failure is an S3 outage, all retries happen during the outage. 100% failure rate. If 1,000 jobs fail simultaneously, they all retry at t=1s, t=2s, t=3s - DDoS-ing your storage.

**Reproduction:**
1. Configure a worker that always throws.
2. Add 100 jobs.
3. Watch Redis `MONITOR` - spikes of activity at exact intervals.

**Fix:**
```typescript
backoff: {
  type: 'exponential',
  delay: 5000, // 5s -> 10s -> 20s
}
```

**WHY:** Exponential backoff gives failing dependencies time to recover. Jitter desynchronizes retries. This is how TCP works. Trust TCP.

### Bug 4: DLQ Not Monitored

**How to Introduce:** Send jobs to DLQ but never build the `/admin/dlq` endpoint or alerts.

**Symptoms:** Failed jobs accumulate in Redis. Your `video` table shows `status = 'failed'` but you don't know why. Users email support. Support has no logs. Weeks later, Redis memory is full.

**Reproduction:**
1. Let 500 jobs fail and move to DLQ.
2. Run `redis-cli LLEN bull:video-dlq:wait` - it's 500.
3. No one knows.

**Fix:**
```typescript
// Periodic DLQ check with proper async loop (no setInterval + await)
async function monitorDLQ() {
  while (true) {
    try {
      const count = await dlq.getWaitingCount();
      if (count > 10) {
        console.error(`[ALERT] DLQ has ${count} jobs!`);
        // Send to PagerDuty / Slack / email
      }
    } catch (err) {
      console.error('DLQ monitoring error:', err);
    }
    await new Promise((r) => setTimeout(r, 60000));
  }
}
monitorDLQ();
```

**WHY:** A DLQ is only useful if a human looks at it. Unmonitored DLQ is just a slower trash can.

### Bug 5: Progress Race Condition

**How to Introduce:** Two workers update the `videos.progress` column independently without coordination.

```typescript
// BROKEN - Worker A sets progress to 30%, Worker B sets it to 60%
// If they cross, user sees 30% after seeing 60%
await db.query('UPDATE videos SET progress = $1 WHERE id = $2', [progress, videoId]);
```

**Symptoms:** Progress bar jumps backward. "45%... 30%... 60%..." User thinks it's broken.

**Reproduction:**
1. Start two transcode workers.
2. Upload a video.
3. Both workers process different formats and call `updateProgress`.
4. The slower worker's update overwrites the faster one.

**Fix:**
```typescript
// Option A: Atomic increment (if progress is cumulative)
// Not ideal here since progress is computed, not additive

// Option B: Server-side progress calculation
// Don't store progress on the video row. Compute it from job states.
app.get('/progress/:videoId', async (req, res) => {
  const jobs = await transcodeQueue.getJobs(['active', 'completed', 'waiting']);
  const videoJobs = jobs.filter(j => j.data.videoId === req.params.videoId);
  // Calculate aggregate progress from job.progress values
});

// Option C: Per-format progress, aggregated on read
// Store progress per job in Redis, aggregate in the SSE endpoint
```

**WHY:** Concurrent writes to the same field without atomic operations or ordering guarantees produce undefined behavior. Aggregate on read, or use atomic operations.

---

## Section 6: Scaling Considerations

### How Many Workers Per Queue?

| Queue | Workers | Concurrency | Reason |
|-------|---------|-------------|--------|
| Transcode | 4 per machine | 1 | CPU-bound. Match cores. |
| Thumbnail | 2 per machine | 5 | I/O-bound, fast. |
| Audio | 2 per machine | 2 | Balanced. |

**Scale horizontally** by adding worker containers. **Scale vertically** by giving transcode workers bigger CPUs. Don't scale transcode vertically beyond ~8 cores - ffmpeg doesn't always parallelize perfectly.

### Priority Queues

```typescript
await transcodeQueue.add('transcode', data, {
  priority: tier === 'enterprise' ? 1 : tier === 'pro' ? 3 : 5,
});
```

BullMQ uses a Redis SortedSet for priorities. O(log N) insertion. Fine for 1,000 jobs/hour. If you hit 1M jobs/hour, consider dedicated high-priority queues instead (avoids SortedSet overhead).

### Job Timeouts and Stalled Job Detection

```typescript
const worker = new Worker('video-transcode', processor, {
  connection: redis,
  lockDuration: 30000,       // 30s lock
  stalledInterval: 30000,    // check every 30s
  maxStalledCount: 2,        // retry stalled job twice, then fail
});
```

**WHY:** If a worker dies, its job is "stalled." BullMQ detects this and re-assigns the job. Without it, the job hangs forever.

### The Right Metrics

| Metric | Why It Matters | Alert When |
|--------|---------------|------------|
| Queue depth | Backlog size | > 500 jobs for > 5 min |
| Processing time (p95) | User experience | > 2x baseline |
| Error rate | Health | > 5% for > 2 min |
| DLQ depth | Human intervention needed | > 0 for > 10 min |
| Worker count | Capacity | < expected for > 2 min |

**WRONG metric to alert on:** "Job completed count dropped." That's a lagging indicator. Queue depth is leading.

---

## Section 7: Deployment

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: videoapp
      POSTGRES_PASSWORD: videopass
      POSTGRES_DB: videoqueue
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U videoapp -d videoqueue"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build: .
    command: pnpm tsx src/server.ts
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://videoapp:videopass@postgres:5432/videoqueue
      - REDIS_HOST=redis
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker-transcode:
    build: .
    command: pnpm tsx src/workers/transcode.ts
    environment:
      - DATABASE_URL=postgresql://videoapp:videopass@postgres:5432/videoqueue
      - REDIS_HOST=redis
      - WORKER_CPU_AFFINITY=1
    deploy:
      replicas: 4
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker-thumbnail:
    build: .
    command: pnpm tsx src/workers/thumbnail.ts
    environment:
      - DATABASE_URL=postgresql://videoapp:videopass@postgres:5432/videoqueue
      - REDIS_HOST=redis
    deploy:
      replicas: 2
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker-audio:
    build: .
    command: pnpm tsx src/workers/audio.ts
    environment:
      - DATABASE_URL=postgresql://videoapp:videopass@postgres:5432/videoqueue
      - REDIS_HOST=redis
    deploy:
      replicas: 2
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  pgdata:
  redisdata:
```

> **EDUCATIONAL NOTE:** `depends_on` only ensures container start order, not readiness. Workers will crash-loop if they start before Redis/Postgres are accepting connections. We added `healthcheck` conditions so services wait until dependencies are actually healthy before starting (Major Fix M11).

**WHY separate worker containers:** If thumbnail jobs spike, you can `docker compose up -d --scale worker-thumbnail=10` without touching the API or transcode workers. Independent scaling per resource profile.

### Dockerfile

```dockerfile
FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
```

**WHY Alpine:** Small image. Node 22: latest LTS. `corepack`: pnpm without global install.

---

## Section 8: Post-Mortem Template

When a job queue incident happens - and it will - use this template.

```markdown
# Post-Mortem: [Incident Title]

## Metadata
- Date: YYYY-MM-DD
- Severity: SEV1 / SEV2 / SEV3
- Duration: HH:MM
- Detected by: Alert / User / Manual

## Summary
One sentence: What happened and what was the user impact?

## Timeline
- HH:MM - First error logged
- HH:MM - Alert fired (or didn't fire?)
- HH:MM - Mitigation applied
- HH:MM - Fully resolved

## Root Cause
What was the technical root cause? Be specific.

## Impact
- Number of affected videos:
- Number of affected users:
- Data loss: Yes/No
- Revenue impact: $

## What Went Well
- Detection was fast because...
- Rollback worked because...

## What Went Poorly
- The DLQ alert didn't fire because...
- We couldn't reprocess jobs because...

## Action Items
| Action | Owner | Due Date |
|--------|-------|----------|
| Add DLQ monitoring alert | @ops | YYYY-MM-DD |
| Fix idempotency in audio worker | @backend | YYYY-MM-DD |
| Document retry policy | @docs | YYYY-MM-DD |

## Lessons Learned
What will we do differently next time?
```

**WHY a template:** In the heat of an incident, you forget to ask "did we lose data?" or "why didn't the alert fire?" The template forces structured thinking. It turns a blame session into a learning session.

---

## Summary

You built a distributed job queue that can:

- Accept video uploads and queue transcoding, thumbnail, and audio work
- Process 1,000+ videos/hour with independently scalable workers
- Retry transient failures with exponential backoff and jitter
- Park permanent failures in a monitored dead letter queue
- Stream real-time progress to users via SSE
- Prevent duplicate work with idempotent job design
- Deploy via Docker Compose with separate API and worker containers

**The hard parts weren't the code.** They were the decisions:
- Why separate queues? Because one slow job shouldn't block fast ones.
- Why a DLQ? Because some failures need a human, not a robot.
- Why idempotency? Because networks fail and retries are guaranteed.
- Why backoff? Because hammering a broken service makes it worse.

A job queue is a promise: "We received your work. We will do it. If we fail, we will tell you." Building that promise correctly is what separates a toy from a platform.

---

*Next: Project 7 - Rate Limiting & Abuse Prevention*
