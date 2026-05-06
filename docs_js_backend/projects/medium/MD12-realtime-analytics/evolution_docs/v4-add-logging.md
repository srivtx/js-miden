# MD12 Realtime Analytics — v4 Add Logging

## Overview
Replace `console.log` with Pino and add an `AggregationEngine` that computes tumbling window keys. Logging lets us verify that events land in the expected windows.

## Changes
- Add `pino` and `pino-http`.
- Create `src/aggregation/engine.ts`.
- Log every ingestion batch with window key metadata.

## Code Snippet
```typescript
// src/aggregation/engine.ts
export class AggregationEngine {
  private windowSizeMs: number;

  constructor(windowSizeMs = 60_000) {
    this.windowSizeMs = windowSizeMs;
  }

  getWindowKey(timestamp: Date): string {
    const start = Math.floor(timestamp.getTime() / this.windowSizeMs) * this.windowSizeMs;
    return new Date(start).toISOString();
  }
}
```

```typescript
// ingestion endpoint (excerpt)
import { logger } from '../config/logger.js';

router.post('/', async (req, res) => {
  // ... validation ...
  logger.info({ ingested: events.length, window: engine.getWindowKey(new Date()) }, 'events_ingested');
  await prisma.event.createMany({ data: events });
  res.status(201).json({ ingested: events.length });
});
```

## Rationale
- Structured logs (`{"level":30,"ingested":1000,"window":"2024-01-01T12:00:00.000Z"}`) are parseable by Loki/Grafana.
- Window alignment to epoch (`Math.floor(ts / windowSize)`) ensures all nodes compute the same key.

## Trade-offs
- Logging every batch at high throughput is expensive; we later switch to sampled logging.

## Next Step
Add tests (v5) to assert window key correctness and ingestion behavior.
