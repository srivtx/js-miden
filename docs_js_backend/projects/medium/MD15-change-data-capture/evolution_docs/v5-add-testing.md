# MD15 Change Data Capture — v5 Add Testing

## Overview
Add Vitest tests for event publishing, consumer dispatch, and the offset/out-of-order bugs. Tests verify that consumers process events and that LSN ordering is enforced.

## Changes
- Add `vitest`, `supertest`.
- Create `tests/cdc.test.ts`.

## Code Snippet
```typescript
// tests/cdc.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { pollAndDispatch, setConsumerOffset } from '../src/services/eventBus.js';
import { handleCacheUpdate, getCache, clearCache } from '../src/consumers/cacheConsumer.js';

describe('CDC Consumer', () => {
  beforeEach(async () => {
    clearCache();
    // clean tables ...
  });

  it('updates cache after consuming events', async () => {
    // create user via API ...
    registerConsumer('cache', handleCacheUpdate);
    await pollAndDispatch('cache');
    expect(getCache().get('user:1')).toBeDefined();
  });
});
```

## Rationale
- Tests prove that cache consumers rebuild state correctly from CDC events.
- The out-of-order test documents why `Promise.all` is unsafe for LSN-ordered streams.

## Trade-offs
- Tests need a real PostgreSQL instance (or Docker) because WAL/LSN logic is database-specific.

## Next Step
Switch to ESM (v6).
