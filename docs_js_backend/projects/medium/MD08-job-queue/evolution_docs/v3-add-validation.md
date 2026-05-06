# MD08 Distributed Job Queue — v3 Add Validation

> **Motto**: Validate the payload before the worker pays the price.

## What Changed

Added `zod` schemas for every job type. Validation runs at enqueue time. Invalid payloads return `400` with a clear error message. Added a `JobValidator` registry so new job types declare their own schema.

## Why

- **Worker safety**: A malformed `video.transcode` payload could crash ffmpeg or corrupt files
- **Contract**: The zod schema *is* the API contract between client and worker
- **Debugging**: Validation errors are caught at enqueue, not 5 minutes later in the worker

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│     Zod         │─────▶│  In-Memory      │─────▶│    Worker       │
│  (Uploader) │◀─────│  (validate)     │◀─────│  Map            │◀─────│  (safe payload) │
└─────────────┘      └─────────────────┘      └─────────────────┘      └─────────────────┘
                            │
                            ▼ (400 Bad Request)
                     ┌─────────────────┐
                     │  Clear error    │
                     │  { field, msg } │
                     └─────────────────┘
```

## Code

```typescript
// src/validators/jobs.ts
import { z } from 'zod';

export const videoTranscodeSchema = z.object({
  inputPath: z.string().min(1),
  formats: z.array(z.enum(['mp4', 'webm', 'mov'])).min(1),
});

export const notifyEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
});

export const jobValidators = {
  'video.transcode': videoTranscodeSchema,
  'notify.email': notifyEmailSchema,
} as const;

export type JobType = keyof typeof jobValidators;

// src/server.ts
import { jobValidators } from './validators/jobs.js';

app.post('/jobs', (req: Request, res: Response) => {
  const { type, payload } = req.body;
  const validator = jobValidators[type as JobType];

  if (!validator) {
    res.status(400).json({ error: `Unknown job type: ${type}` });
    return;
  }

  const result = validator.safeParse(payload);
  if (!result.success) {
    res.status(400).json({
      error: 'Validation failed',
      issues: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })),
    });
    return;
  }

  const job: Job = {
    id: crypto.randomUUID(),
    type,
    payload: result.data,
    status: 'pending',
    createdAt: new Date(),
  };
  jobs.set(job.id, job);
  res.status(202).json({ jobId: job.id, status: job.status });
});
```

## Decisions

**Option A: Central validator file**
- Pros: All schemas in one place
- Cons: Merge conflicts when adding new job types

**Option B: Per-job-type validator modules**
- Pros: Scales with team size
- Cons: More files

**Chosen: A for now** — only 2 job types; refactor to B when we hit 5+.

## Problems We Accepted

- Validation is only at enqueue; worker could still receive bad data if we bypass the API
- No idempotency — submitting the same job twice creates duplicates
- Still no persistence

## Checklist

- [ ] Every job type has a zod schema
- [ ] Unknown job types return 400
- [ ] Validation errors include field path and message
- [ ] Worker does NOT re-validate (trust the API, but be defensive)

## Next Step

Add structured logging so we can trace a job from enqueue to completion.
