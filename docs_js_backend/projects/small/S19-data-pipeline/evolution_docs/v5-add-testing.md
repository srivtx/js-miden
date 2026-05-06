# S19 Data Pipeline — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You refactor the pipeline to "simplify" error handling:

```ts
// BEFORE — correct
async function load(destination: string, records: Record[], pipelineId: string): Promise<void> {
  for (const record of records) {
    try {
      validateRecord(record);
      const existing = processedRecords.get(destination) || [];
      processedRecords.set(destination, [...existing, record]);
    } catch (error) {
      const status = pipelines.get(pipelineId);
      if (status) status.recordsFailed++;
    }
  }
}

// AFTER — "cleaner" but BROKEN
async function load(destination: string, records: Record[], pipelineId: string): Promise<void> {
  // Oops, removed the try/catch — one bad row fails the whole batch
  for (const record of records) {
    validateRecord(record);
    const existing = processedRecords.get(destination) || [];
    processedRecords.set(destination, [...existing, record]);
  }
}
```

Without tests, this ships. One bad row now fails the entire pipeline. 999 good records are rejected because of 1 invalid email. It's worse than the original — you had error isolation and now you don't.

## The Fix: Comprehensive Pipeline Tests

```ts
// tests/pipeline.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { runPipeline, getDestinationRecords, getPipelineStatus } from '../src/pipeline.js';

describe('Data Pipeline', () => {
  it('should run pipeline successfully', async () => {
    const id = await runPipeline('test.csv', 'test-db');
    const status = getPipelineStatus(id);
    assert.strictEqual(status?.status, 'completed');
  });

  it('should be idempotent - re-running should not create duplicates', async () => {
    const source = 'dup-test.csv';
    const destination = 'dup-test-db';
    
    await runPipeline(source, destination);
    await runPipeline(source, destination);
    
    const records = getDestinationRecords(destination);
    const uniqueIds = new Set(records.map(r => r.id));
    
    assert.strictEqual(uniqueIds.size, records.length, `Found ${records.length - uniqueIds.size} duplicate records`);
  });

  it('should isolate bad rows and continue processing', async () => {
    const source = 'error-test.csv';
    const destination = 'error-test-db';
    
    const id = await runPipeline(source, destination);
    const status = getPipelineStatus(id);
    
    assert.strictEqual(status?.status, 'completed');
    assert.strictEqual(status?.recordsProcessed, 3, 'Should process 3 valid records');
    assert.strictEqual(status?.recordsFailed, 1, 'Should record 1 failed row');
  });
});
```

**What tests prevent:**
- Missing error isolation? **Caught** — 3 valid records must be processed.
- Duplicate records? **Caught** — unique count must equal total count.
- Pipeline crash? **Caught** — status must be `completed` even with bad rows.

## The Pain That Remains

Your tests import from ESM files, but the project still has CJS vestiges. Modern Node.js is ESM-first. The test runner requires special flags because it's straddling both worlds.

## What v6 Fixes

Switch to ESM fully. CommonJS is legacy.
