# v6 — Switching to ESM

You're trying to use `bullmq` for Redis-backed queues. It's ESM-only.

```
Error [ERR_REQUIRE_ESM]: require() of ES Module bullmq not supported
```

Your queue is CommonJS. Every modern queue library is ESM. Time to switch.

## The Fix: Go All-In on ESM

```json
// package.json
{
  "type": "module"
}
```

```ts
// queue.ts
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { createServer } from 'node:http';

const connection = new IORedis({ host: process.env.REDIS_HOST });
const emailQueue = new Queue('emails', { connection });

const worker = new Worker('emails', async (job) => {
  await sendEmail(job.data);
}, { connection });
```

## Why ESM?

- **Modern queue libraries work** — `bullmq`, `sqs-consumer`, ESM-only packages
- **Top-level await** — clean async initialization for Redis connections
- **Static analysis** — bundlers can tree-shake when you split producer/consumer services
- **`node:` prefixes** — clear built-in vs npm imports

## Migration

- Add `"type": "module"` to `package.json`
- Use `.js` extensions in all imports
- Replace `__dirname` with `import.meta.url`

**Next:** Production setup — Redis, persistence, DLQ, and exactly-once processing.
