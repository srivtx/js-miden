# v4-add-logging

## Goal
Trace every upload through validation, storage, and post-processing.

## Changes
1. `pino` child logger per request with `requestId`.
2. Log file size, mimetype, validation result, and storage backend.
3. Log errors with stack traces only in dev.

## Code

```ts
// src/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'dev'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
```

```ts
// src/controller.ts
import { logger } from './logger.js';

export async function uploadFile(req: Request, res: Response) {
  const log = logger.child({ requestId: req.headers['x-request-id'] || randomUUID() });

  if (!req.file) {
    log.warn('upload_rejected_no_file');
    return res.status(400).json({ error: 'No file provided' });
  }

  log.info({ size: req.file.size, mimetype: req.file.mimetype }, 'upload_received');

  // ... validation, scan, store

  log.info({ path: storedPath }, 'upload_stored');
}
```

## Decisions
- `pino-pretty` in dev only — JSON logs in prod for Loki/ELK ingestion.
- `requestId` propagation lets us trace a single upload across middleware, controller, and services.

## Risks
- Logging file content (base64) would bloat logs. Never log buffers.
