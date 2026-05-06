# MD08 Distributed Job Queue — v5 Add Testing

> **Motto**: If you can't test a queue, you can't trust it.

## What Changed

Added `vitest` + `supertest` + `ioredis-mock`. Unit tests for validators, worker tests with mocked child processes, and integration tests for the full enqueue → process flow.

## Why

- **Reliability**: A job queue is infrastructure; bugs affect every downstream service
- **Refactoring**: v6 (ESM) and v7 (BullMQ) will touch every file — tests prove nothing broke
- **Documentation**: Tests show the intended behavior better than prose

## Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Vitest        │─────▶│   Supertest     │─────▶│   Express App   │
│   (runner)      │      │   (HTTP client) │      │   (in-memory)   │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                                          │
                                                          ▼
                                                   ┌──────────────┐
                                                   │  ioredis-mock│
                                                   │  or MSW      │
                                                   └──────────────┘
```

## Code

```typescript
// tests/jobs.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('POST /jobs', () => {
  it('enqueues a valid video transcode job', async () => {
    const res = await request(app)
      .post('/jobs')
      .send({ type: 'video.transcode', payload: { inputPath: '/tmp/video.mp4', formats: ['mp4', 'webm'] } })
      .expect(202);

    expect(res.body.jobId).toBeDefined();
    expect(res.body.status).toBe('pending');
  });

  it('rejects unknown job types', async () => {
    const res = await request(app)
      .post('/jobs')
      .send({ type: 'unknown.job', payload: {} })
      .expect(400);

    expect(res.body.error).toContain('Unknown job type');
  });

  it('rejects invalid payload', async () => {
    const res = await request(app)
      .post('/jobs')
      .send({ type: 'video.transcode', payload: { inputPath: '', formats: [] } })
      .expect(400);

    expect(res.body.issues).toBeDefined();
  });
});

// tests/worker.test.ts
import { describe, it, expect, vi } from 'vitest';
import { transcodeVideo } from '../src/services/transcode.js';
import { spawn } from 'child_process';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

describe('transcodeVideo', () => {
  it('transcodes all formats', async () => {
    (spawn as any).mockImplementation(() => ({
      on: vi.fn((event, cb) => {
        if (event === 'close') cb(0);
      }),
    }));

    const result = await transcodeVideo('job-1', '/tmp/video.mp4', ['mp4', 'webm']);
    expect(result.outputs).toHaveLength(2);
  });

  it('fails when ffmpeg exits with error', async () => {
    (spawn as any).mockImplementation(() => ({
      on: vi.fn((event, cb) => {
        if (event === 'close') cb(1);
      }),
    }));

    await expect(transcodeVideo('job-1', '/tmp/video.mp4', ['mp4'])).rejects.toThrow('ffmpeg exited with code 1');
  });
});
```

## Decisions

**Option A: Jest**
- Pros: Ubiquitous, snapshot testing
- Cons: ESM support is painful, slower

**Option B: Vitest**
- Pros: Native ESM, Jest-compatible API, fast
- Cons: Smaller ecosystem

**Chosen: Vitest** — aligns with v6 ESM switch.

## Problems We Accepted

- Worker tests require mocking `child_process`; not a perfect simulation
- No load tests yet
- Redis mocking is limited; some BullMQ features are hard to test

## Checklist

- [ ] All routes have at least one happy-path and one error test
- [ ] Zod validation failures are tested with precise error shapes
- [ ] Worker functions are tested with mocked dependencies
- [ ] Tests run in < 5 seconds for the entire suite
- [ ] Coverage report is generated; target 80%+ for services

## Next Step

Switch to ESM so we can use top-level await and tree-shake BullMQ.
