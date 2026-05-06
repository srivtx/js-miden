import { describe, it } from 'node:test';
import assert from 'node:assert';
import { runPipeline, getDestinationRecords, getPipelineStatus } from '../src/pipeline.js';

describe('Data Pipeline', () => {
  it('should run pipeline successfully', async () => {
    const id = await runPipeline('test.csv', 'test-db');
    const status = getPipelineStatus(id);
    assert.strictEqual(status?.status, 'completed');
  });

  // FAILING TEST: Not idempotent
  it('should be idempotent - re-running should not create duplicates', async () => {
    const source = 'dup-test.csv';
    const destination = 'dup-test-db';
    
    // Run twice with same source
    await runPipeline(source, destination);
    await runPipeline(source, destination);
    
    const records = getDestinationRecords(destination);
    const uniqueIds = new Set(records.map(r => r.id));
    
    // All records should be unique (no duplicates)
    // Currently fails because re-running creates duplicates
    assert.strictEqual(uniqueIds.size, records.length, `Found ${records.length - uniqueIds.size} duplicate records`);
  });

  // FAILING TEST: No error isolation
  it('should isolate bad rows and continue processing', async () => {
    const source = 'error-test.csv';
    const destination = 'error-test-db';
    
    const id = await runPipeline(source, destination);
    const status = getPipelineStatus(id);
    
    // Should process valid records even if some fail
    // Currently fails because one bad row fails entire batch
    assert.strictEqual(status?.status, 'completed');
    assert.strictEqual(status?.recordsProcessed, 3, 'Should process 3 valid records');
    assert.strictEqual(status?.recordsFailed, 1, 'Should record 1 failed row');
  });
});
