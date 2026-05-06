# MD15 Change Data Capture — v2 Add TypeScript

## Overview
Migrate to TypeScript and define `ChangeEvent`, `ConsumerOffset`, and `CdcConfig` interfaces. These types formalize the contract between the database, the event bus, and downstream consumers.

## Changes
- `tsconfig.json` with `strict: true`
- `src/types.ts`

## Code Snippet
```typescript
// src/types.ts
export interface ChangeEvent {
  lsn: number;
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: number;
}

export interface ConsumerOffset {
  consumerId: string;
  lastLsn: number;
}
```

## Rationale
- Typed events prevent consumers from accessing missing fields.
- `lsn` (Log Sequence Number) replaces the unreliable `updated_at` timestamp.

## Trade-offs
- `BIGSERIAL` can theoretically overflow; production should use `pg_current_wal_lsn()`.

## Next Step
Add validation (v3) and replace polling with trigger-based or WAL-based event publishing.
