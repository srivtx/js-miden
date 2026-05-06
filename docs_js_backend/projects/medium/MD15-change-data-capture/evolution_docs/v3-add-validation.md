# MD15 Change Data Capture — v3 Add Validation

## Overview
Add Zod schemas for incoming rows and create the `cdc_events` table. We move from polling to an application-level WAL simulation: every INSERT/UPDATE/DELETE in the route handler also writes a row to `cdc_events` inside the same transaction.

## Changes
- Add `zod`.
- Create `src/services/walReader.ts` with `publishChange` and `readChangesSince`.
- Update routes to publish events.

## Code Snippet
```typescript
// src/services/walReader.ts
import { query } from './db.js';

export async function publishChange(event: ChangeEvent) {
  await query(
    `INSERT INTO cdc_events (lsn, table_name, operation, before_json, after_json)
     VALUES ($1, $2, $3, $4, $5)`,
    [event.lsn, event.table, event.operation, JSON.stringify(event.before), JSON.stringify(event.after)]
  );
}

export async function readChangesSince(lastLsn: number, limit = 100): Promise<ChangeEvent[]> {
  const result = await query(
    `SELECT * FROM cdc_events WHERE lsn > $1 ORDER BY lsn ASC LIMIT $2`,
    [lastLsn, limit]
  );
  return result.rows.map((row: any) => ({
    lsn: Number(row.lsn),
    table: row.table_name,
    operation: row.operation,
    before: row.before_json,
    after: row.after_json,
    timestamp: new Date(row.created_at).getTime(),
  }));
}
```

## Rationale
- Writing to `cdc_events` inside the same transaction as the business change guarantees atomicity (no phantom events on rollback).
- `ORDER BY lsn ASC` preserves commit order for consumers.

## Trade-offs
- Application-level WAL is simpler than `pg_logical` but couples CDC to the app codebase.
- Double-write (business table + cdc_events) adds latency.

## Next Step
Add structured logging (v4) to trace event publishing and consumer dispatch.
