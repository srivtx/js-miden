# MD08 Distributed Job Queue — v6 Switch to ESM

> **Motto**: ESM is the standard; CommonJS is legacy.

## What Changed

Converted the entire codebase from CommonJS (`require`, `module.exports`) to ESM (`import`, `export`). Updated `tsconfig.json` to `"module": "NodeNext"`, renamed imports to include `.js` extensions, and switched BullMQ to its ESM build.

## Why

- **Tree-shaking**: BullMQ drops unused features under ESM
- **Top-level await**: `await redis.ping()` in module scope for health checks
- **Future-proof**: Node.js 20+ treats ESM as first-class

## Architecture

No architecture change — same boxes, better wires.

## Code

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

```json
// package.json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest",
    "worker": "node dist/worker.js"
  }
}
```

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

## Decisions

**Option A: Keep CommonJS, use dynamic import for ESM-only deps**
- Pros: Zero migration cost
- Cons: Fragmented codebase, loses top-level await

**Option B: Full ESM migration**
- Pros: Clean, consistent, future-proof
- Cons: Must add `.js` extensions to all relative imports

**Chosen: B** — the project is medium-sized; migration took 30 minutes.

## Problems We Accepted

- Some `@types/*` packages assume CommonJS; needed to update `tsconfig.json` `esModuleInterop`
- `__dirname` no longer exists; replaced with `fileURLToPath(import.meta.url)`
- Vitest config needed `globals: false` to avoid CJS interop issues

## Checklist

- [ ] `"type": "module"` is in `package.json`
- [ ] All relative imports end with `.js`
- [ ] `tsconfig.json` uses `"module": "NodeNext"`
- [ ] No `require()` or `module.exports` remains in `src/`
- [ ] Tests pass under ESM (vitest handles this natively)

## Next Step

Production setup: Redis, BullMQ, retries, DLQ, idempotency, and worker pools.
