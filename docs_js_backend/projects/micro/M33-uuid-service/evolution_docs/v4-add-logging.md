# M33 UUID Service — v4 Add Logging

## The Bug: Production Visibility Crisis

You deploy v3. Support ticket arrives: *"UUID v7 timestamps are 50 years in the past."*

You check the code:

```ts
function uuidV7() {
  const timestamp = Math.floor(new Date().getTime() / 1000); // BUG: seconds
  // ...
}
```

The bug is obvious in hindsight. But you had no logs showing:

- When each UUID was generated
- What timestamp was embedded
- What the expected vs actual values were

```ts
// Without logging — silent corruption
app.get('/uuid/v7', (_req, res) => {
  res.json({ uuid: uuidV7() }); // If this is wrong, you never know why
});
```

## The Fix: Structured Logging

```ts
import { logger } from './logger.js';

export function uuidV7(): string {
  const now = Date.now();
  logger.debug({ timestamp: now }, 'Generating UUID v7');

  const timeHex = now.toString(16).padStart(12, '0');
  const randA = Math.floor(Math.random() * 0x1000)
    .toString(16)
    .padStart(3, '0');
  const randB = Math.floor(Math.random() * 0x4000)
    .toString(16)
    .padStart(4, '0');
  const randC = Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');

  const uuid = `${timeHex.slice(0, 8)}-${timeHex.slice(8)}-7${randA}-${randB}-${randC}`;
  logger.info({ uuid, timestamp: now }, 'UUID v7 generated');
  return uuid;
}
```

```ts
// index.ts
app.post('/uuid/bulk', (req: Request, res: Response) => {
  const validation = validateBulkRequest(req.body);
  if (!validation.valid) {
    logger.warn({ error: validation.error }, 'Bulk request validation failed');
    return res.status(400).json({ error: validation.error });
  }

  const { count, type } = validation.data!;
  logger.info({ count, type }, 'Bulk UUID generation started');
  const results = bulkGenerate(count, type);
  logger.info({ count, type, resultCount: results.length }, 'Bulk UUID generation completed');
  res.json({ count, type, results });
});
```

Now your logs tell the story:
```json
{"level":"info","uuid":"018f...","timestamp":1704153600000,"msg":"UUID v7 generated"}
{"level":"warn","error":"count must be an integer between 1 and 1000","msg":"Bulk request validation failed"}
```

## The Pain That Remains

You fix the v7 timestamp bug (divide by 1000). In the process, you accidentally change the random bits to use `Math.random()` without the proper v7 bitmask. UUIDs are no longer valid v7. No test caught it.

## What v5 Fixes

Testing. Silent breakage when adding features is unacceptable.
