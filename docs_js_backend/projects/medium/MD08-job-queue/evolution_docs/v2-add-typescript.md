# MD08 Distributed Job Queue — v2 Add TypeScript

> **Motto**: Types are the schema of your queue.

## What Changed

Migrated to TypeScript. Added `tsconfig.json`, interfaces for `Job`, `JobPayload`, and `JobStatus`. Replaced the in-memory array with a typed Map. Added strict null checks.

## Why

- **Payload shapes vary**: A `video.transcode` job has `inputPath` and `formats`; a `notify.email` job has `to` and `subject` — types prevent mixing them up
- **Refactoring safety**: Renaming `JobStatus.PROCESSING` catches all worker references
- **Team velocity**: New engineers understand the domain model without runtime exploration

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│  Express + TS   │─────▶│  In-Memory      │
│  (Uploader) │◀─────│  (typed jobs)   │◀─────│  Map<string,Job>│
└─────────────┘      └─────────────────┘      └─────────────────┘
```

## Code

```typescript
// src/types.ts
export type JobType = 'video.transcode' | 'notify.email' | 'report.generate';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job {
  id: string;
  type: JobType;
  payload: unknown;
  status: JobStatus;
  createdAt: Date;
  updatedAt?: Date;
  result?: unknown;
  error?: string;
}

// src/server.ts
import express, { Request, Response } from 'express';
import { Job, JobStatus } from './types.js';

const app = express();
app.use(express.json());

const jobs = new Map<string, Job>();

app.post('/jobs', (req: Request, res: Response) => {
  const job: Job = {
    id: crypto.randomUUID(),
    type: req.body.type,
    payload: req.body.payload,
    status: 'pending',
    createdAt: new Date(),
  };
  jobs.set(job.id, job);
  res.status(202).json({ jobId: job.id, status: job.status });
});

app.get('/jobs/:id', (req: Request, res: Response) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  res.json(job);
});
```

## Decisions

**Option A: Discriminated union for payloads**
- Pros: Exact type per job type
- Cons: Verbose, needs type guards

**Option B: `unknown` payload with runtime validators**
- Pros: Flexible, easy to add new job types
- Cons: Less compile-time safety

**Chosen: B** — we validate at runtime (v3) and keep types simple.

## Problems We Accepted

- Still no persistence — restart the server, lose all jobs
- Still no retries — a failed job stays failed forever
- Still no concurrency — one job at a time

## Checklist

- [ ] `tsconfig.json` has `strict: true`
- [ ] All route handlers use explicit `Request` / `Response` types
- [ ] `Job` interface is shared between API and worker
- [ ] No `any` in the job lifecycle

## Next Step

Add runtime validation so bad payloads fail before they reach the worker.
