# MD12 Realtime Analytics — v3 Add Validation

## Overview
Introduce Zod schemas for event ingestion and build the `POST /events` endpoint. At this stage we persist raw events to PostgreSQL but do not yet aggregate them.

## Changes
- Add `zod` and `uuid` packages.
- Create `src/api/ingestion.ts`.
- Define `eventSchema` with limits (`eventType` max 100 chars, payload as `z.record(z.unknown())`).

## Code Snippet
```typescript
// src/api/ingestion.ts
import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/index.js';

const eventSchema = z.object({
  eventType: z.string().min(1).max(100),
  payload: z.record(z.unknown()).default({}),
  source: z.string().min(1).max(200).default('api'),
  timestamp: z.string().datetime().optional(),
});

const router = Router();

router.post('/', async (req, res) => {
  const raw = Array.isArray(req.body) ? req.body : [req.body];
  const validated = raw.map((r) => eventSchema.parse(r));
  const events = validated.map((e) => ({
    id: uuidv4(),
    ...e,
    timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
  }));
  await prisma.event.createMany({ data: events });
  res.status(201).json({ ingested: events.length });
});

export { router as eventRouter };
```

## Rationale
- Validation at the edge rejects garbage before it hits the database.
- `createMany` is efficient for bulk ingestion.
- We intentionally do **not** update counters yet, so we can discuss aggregation strategies in v4/v7.

## Trade-offs
- Synchronous DB write adds latency; we accept this for durability in v3.
- No batch size limit yet (added in v7).

## Next Step
Add structured logging (v4) so we can observe ingestion throughput.
