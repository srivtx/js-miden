# MD15 Change Data Capture — v7 Production Setup

## Overview
The final evolution step hardens the CDC pipeline for production. We enforce strict LSN ordering, idempotent consumers, persistent offset storage with validation, and Docker deployment.

## Changes
- **Strict Ordering**: Replace `Promise.all` with a sequential `for...of` loop in `pollAndDispatch`.
- **Batch Offsets**: Update offset only after the entire batch succeeds, preventing replay gaps on crash.
- **Offset Validation**: `getLatestLsn()` ensures a corrupted offset is detected and reset.
- **Idempotent Consumers**: Cache consumers use `set`/`delete` (safe to replay). Notification consumers deduplicate by LSN.
- **Transaction Boundaries**: `publishChange` runs inside the same DB transaction as the business mutation.
- **Deployment**: `docker-compose.yml` with PostgreSQL.

## Code Snippet
```typescript
// src/services/eventBus.ts (production excerpt)
export async function pollAndDispatch(consumerId: string): Promise<number> {
  let offset = await getConsumerOffset(consumerId);
  const maxLsn = await getLatestLsn();
  if (offset > maxLsn) {
    logger.warn({ consumerId, offset, maxLsn }, 'offset_ahead_of_wal');
    await setConsumerOffset(consumerId, maxLsn);
    offset = maxLsn;
  }

  const events = await readChangesSince(offset);
  const handler = consumers.get(consumerId);
  if (!handler || events.length === 0) return offset;

  // Strict ordering: sequential processing
  for (const event of events) {
    await handler(event);
  }

  // Batch offset update
  const lastLsn = events[events.length - 1].lsn;
  await setConsumerOffset(consumerId, lastLsn);
  logger.info({ consumerId, processed: events.length, lastLsn }, 'batch_dispatched');
  return lastLsn;
}
```

## Rationale
- Sequential processing guarantees that an UPDATE never arrives before its INSERT.
- Offset validation prevents silent data loss from corrupted checkpoints.
- Idempotent consumers make at-least-once delivery safe.

## Trade-offs
- Sequential processing is slower than parallel; use partition-based parallelism for high throughput.
- Application-level CDC is not as robust as `pg_logical` slots; production should migrate to Debezium.

## References
- `docs/02-DECISIONS.md` — simulated WAL, at-least-once delivery, PostgreSQL offsets.
- `docs/06-BUGS.md` — out-of-order delivery, missed changes, phantom events.
- `docs/03-CONCEPTS.md` — WAL, LSN, exactly-once vs idempotency, event ordering.
