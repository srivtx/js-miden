# MD14 Monitoring Stack — v3 Add Validation

## Overview
Add Zod schemas for metric ingestion and alert rules. Introduce the `POST /metrics` endpoint and the in-memory `metricStore`. At this stage there are no cardinality limits or retention policies.

## Changes
- Add `zod`.
- Create `src/routes/metrics.ts` and `src/services/metricStore.ts`.

## Code Snippet
```typescript
// src/routes/metrics.ts
import { Router } from 'express';
import { z } from 'zod';
import { recordMetric } from '../services/metricStore.js';

const recordSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['counter', 'gauge', 'histogram']),
  value: z.number(),
  labels: z.record(z.string()).default({}),
  timestamp: z.number().optional(),
});

const router = Router();

router.post('/', (req, res) => {
  const body = recordSchema.parse(req.body);
  recordMetric(body.name, body.type, body.value, body.labels, body.timestamp);
  res.status(201).json({ success: true });
});

export default router;
```

```typescript
// src/services/metricStore.ts
const timeSeriesMap = new Map<string, TimeSeries>();

export function recordMetric(name: string, type: MetricType, value: number, labels: Labels = {}, timestamp = Date.now()) {
  const key = seriesKey(name, labels);
  let ts = timeSeriesMap.get(key);
  if (!ts) {
    ts = { name, type, labels, values: [] };
    timeSeriesMap.set(key, ts);
  }
  ts.values.push({ timestamp, value });
}
```

## Rationale
- Validation rejects malformed metrics before they enter the store.
- In-memory map is O(1) for insertion, suitable for a single-node agent.

## Trade-offs
- No cardinality limit yet: a misconfigured client can OOM the process.
- No retention: memory grows forever.

## Next Step
Add structured logging (v4) to observe metric ingestion and store growth.
