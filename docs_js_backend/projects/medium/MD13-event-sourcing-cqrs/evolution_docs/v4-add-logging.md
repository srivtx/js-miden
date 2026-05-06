# MD13 Event Sourcing + CQRS — v4 Add Logging

## Overview
Add Pino structured logging to commands and introduce the first read-model projection. Logs record command execution time, event append latency, and projection lag.

## Changes
- Add `pino`.
- Create `src/projections/order-projection.ts`.
- Log every command and projection.

## Code Snippet
```typescript
// src/projections/order-projection.ts
import { prisma } from '../config/index.js';
import { logger } from '../config/logger.js';

export async function projectOrder(aggregateId: string) {
  const events = await prisma.eventStore.findMany({
    where: { aggregateId },
    orderBy: { version: 'asc' },
  });
  if (events.length === 0) return;

  const state = replay(events);
  await prisma.orderReadModel.upsert({
    where: { aggregateId },
    create: { aggregateId, ...state, version: events.length, projectedAt: new Date() },
    update: { ...state, version: events.length, projectedAt: new Date() },
  });
  logger.info({ aggregateId, version: events.length }, 'order_projected');
}
```

## Rationale
- Projections build the read model from the event log.
- Logging projection lag helps detect eventual-consistency gaps.
- `upsert` makes projections idempotent and safe to rerun.

## Trade-offs
- Synchronous projections couple write and read latency; we make them async in v7.

## Next Step
Add tests (v5) to assert event replay correctness and projection idempotency.
