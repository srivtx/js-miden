# MD08 Distributed Job Queue — v4 Add Logging

> **Motto**: Log every job like it's your last.

## What Changed

Replaced `console.log` with `pino` structured JSON logging. Every job gets a `jobId` in every log line. Workers log start, progress, completion, and failure. Added correlation IDs across async boundaries.

## Why

- **Observability**: A job is stuck at 50% — search logs by `jobId` to see which ffmpeg process hung
- **Debugging**: A user says "my video never processed" — trace from enqueue to worker
- **Alerting**: Log-based metrics (`job.failed` > 5/min) trigger PagerDuty

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│   Express       │─────▶│  In-Memory      │
│  (Uploader) │      │  + pino logger  │      │  Map            │
└─────────────┘      └────────┬────────┘      └─────────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │  stdout /    │
                       │  log shipper │
                       └──────────────┘
```

## Code

```typescript
// src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'job-queue' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// src/worker.ts
import { logger } from './utils/logger.js';

async function processJob(job: Job) {
  const log = logger.child({ jobId: job.id, type: job.type });
  log.info('Job started');

  try {
    if (job.type === 'video.transcode') {
      await transcodeVideo(job.id, job.payload.inputPath, job.payload.formats);
    }
    log.info('Job completed');
  } catch (err) {
    log.error({ err }, 'Job failed');
    throw err;
  }
}

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

    log.info({ format, progress: Math.round(((i) / formats.length) * 100) }, 'Transcoding format');
    await runFfmpeg(inputPath, outputPath, format);
    outputs.push(outputPath);
  }

  log.info({ outputs }, 'Transcoding complete');
  return { outputs };
}
```

## Decisions

**Option A: Winston**
- Pros: Transports, formatting
- Cons: Slower, heavier config

**Option B: Pino**
- Pros: Fast, structured by default, ESM-friendly
- Cons: Fewer built-in transports

**Chosen: Pino** — we ship logs to stdout and let the platform handle aggregation.

## Problems We Accepted

- Logs are stdout-only; no log aggregation configured yet
- No progress tracking in the database yet
- Still no retries or DLQ

## Checklist

- [ ] `logger.child()` is used per-job so `jobId` is in every log line
- [ ] Worker logs start, completion, and failure
- [ ] Error logs include the full error object and job context
- [ ] Progress is logged at each step (e.g., per-format transcoding)

## Next Step

Add tests so we can refactor safely.
