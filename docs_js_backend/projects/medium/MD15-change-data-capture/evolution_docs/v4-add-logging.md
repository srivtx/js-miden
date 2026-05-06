# MD15 Change Data Capture — v4 Add Logging

## Overview
Add Pino logging to the event bus and consumers. We introduce `registerConsumer`, `pollAndDispatch`, and offset tracking. Logs record every dispatched event and offset advancement.

## Changes
- Add `pino`.
- Create `src/services/eventBus.ts`.
- Log dispatch loops and handler errors.

## Code Snippet
```typescript
// src/services/eventBus.ts
import { readChangesSince } from './walReader.js';
import { logger } from '../config/logger.js';

const consumers = new Map<string, (event: ChangeEvent) => Promise<void>>();

export function registerConsumer(consumerId: string, handler: (event: ChangeEvent) => Promise<void>) {
  consumers.set(consumerId, handler);
}

export async function pollAndDispatch(consumerId: string): Promise<number> {
  const offset = await getConsumerOffset(consumerId);
  const events = await readChangesSince(offset);
  const handler = consumers.get(consumerId);
  if (!handler) return offset;

  // BUG for education: Promise.all destroys ordering
  await Promise.all(events.map(async (event) => {
    await handler(event);
    await setConsumerOffset(consumerId, event.lsn);
  }));

  logger.info({ consumerId, count: events.length }, 'dispatched');
  return events.length > 0 ? events[events.length - 1].lsn : offset;
}
```

## Rationale
- The event bus decouples producers from consumers.
- Logging dispatch batch sizes helps detect backpressure.
- `Promise.all` is intentionally used here to demonstrate the out-of-order bug fixed in v7.

## Trade-offs
- Updating offset per-event (instead of per-batch) can cause duplicate processing on crash.

## Next Step
Add tests (v5) to assert ordering, idempotency, and offset validation.
