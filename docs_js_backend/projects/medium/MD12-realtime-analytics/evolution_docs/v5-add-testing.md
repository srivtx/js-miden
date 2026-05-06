# MD12 Realtime Analytics — v5 Add Testing

## Overview
Add Vitest tests for the ingestion endpoint and the `AggregationEngine`. We include a test that demonstrates the race-condition bug (GET-SET vs INCR) so the fix in v7 is motivated.

## Changes
- Add `vitest`, `supertest`.
- Create `tests/analytics.test.ts`.

## Code Snippet
```typescript
// tests/analytics.test.ts
import { describe, it, expect } from 'vitest';
import { AggregationEngine } from '../src/aggregation/engine.js';

describe('Windowing', () => {
  it('generates consistent window keys', () => {
    const engine = new AggregationEngine(60000);
    const d1 = new Date('2024-01-01T12:00:00.000Z');
    const d2 = new Date('2024-01-01T12:00:30.000Z');
    expect(engine.getWindowKey(d1)).toBe(engine.getWindowKey(d2));
  });
});
```

## Rationale
- Tests lock in window alignment behavior across DST and timezone changes.
- Integration tests verify `POST /events` → Prisma round-trip.
- We keep the race-condition test as documentation of why atomic operations matter.

## Trade-offs
- Need a test database (SQLite or ephemeral PostgreSQL in Docker).

## Next Step
Switch to ESM (v6) to align with modern Node.js tooling.
