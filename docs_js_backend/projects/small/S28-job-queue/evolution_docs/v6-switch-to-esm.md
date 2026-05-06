# v6-switch-to-esm

## Goal
Adopt ESM and use native `await` for Redis connection setup.

## Changes
1. `"type": "module"` in `package.json`.
2. Top-level `await` for queue readiness checks.
3. All imports use `.js` extension.

## Code

```ts
// src/index.ts
import express from 'express';
import { queueRouter } from './routes.js';

const app = express();
app.use(express.json());
app.use('/', queueRouter);

// Top-level await for readiness
await jobQueue.waitUntilReady();
logger.info('Queue ready');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`S28 listening on ${PORT}`));

export { app };
```

```json
// package.json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "vitest run"
  }
}
```

## Decisions
- Top-level `await` removes the need for an async IIFE in the entry point.
- `tsx` for dev; `tsc` + `node` for production.

## Risks
- BullMQ v5 and ioredis are fully ESM-compatible. Verify if using older versions.
