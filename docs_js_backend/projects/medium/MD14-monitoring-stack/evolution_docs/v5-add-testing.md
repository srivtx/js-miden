# MD14 Monitoring Stack — v5 Add Testing

## Overview
Add Vitest tests for metric ingestion, alert evaluation, and the cardinality/retention bugs. Tests document expected behavior and demonstrate where the current implementation fails.

## Changes
- Add `vitest`, `supertest`.
- Create `tests/metrics.test.ts`.

## Code Snippet
```typescript
// tests/metrics.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { clearStore } from '../src/services/metricStore.js';
import { clearRules } from '../src/services/alertEngine.js';

beforeEach(() => {
  clearStore();
  clearRules();
});

describe('Metrics API', () => {
  it('records a counter', async () => {
    const res = await request(app)
      .post('/metrics')
      .send({ name: 'requests_total', type: 'counter', value: 1, labels: { method: 'GET' } });
    expect(res.status).toBe(201);
  });
});
```

## Rationale
- Tests prevent regressions in metric storage and alert logic.
- The flapping test (`BUG: Alert Flapping`) is kept as documentation.

## Trade-offs
- In-memory store is reset between tests; no persistent state test coverage yet.

## Next Step
Switch to ESM (v6).
