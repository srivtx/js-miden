# S19 Data Pipeline — v4 Add Logging

## The Bug: Production Visibility Crisis

Your pipeline is supposed to move data reliably. But in production:
- You don't know when a pipeline started or finished
- You don't know how many records were processed vs failed
- You don't know if a bad row caused a full batch failure
- You can't tell if the same pipeline ran twice and created duplicates

```ts
// Without logging — silent pipeline
async function runPipeline(source: string, destination: string): Promise<string> {
  const pipelineId = uuid();
  // ... setup ...
  
  try {
    const csvData = await extract(source);
    const transformed = transform(csvData);
    await load(destination, transformed, pipelineId);
    status.status = 'completed';
  } catch (error) {
    status.status = 'failed';
    status.errors.push(error instanceof Error ? error.message : String(error));
  }
  
  return pipelineId;
}
```

The pipeline fails silently. You check the database — some records are there, some aren't. You have no log trail showing what happened.

## The Fix: Structured Logging

```ts
import { logger } from './logger.js';

export async function runPipeline(source: string, destination: string): Promise<string> {
  const pipelineId = uuid();
  logger.info({ pipelineId, source, destination }, 'Pipeline started');
  
  const status: PipelineStatus = {
    id: pipelineId,
    status: 'running',
    recordsProcessed: 0,
    recordsFailed: 0,
    errors: [],
    startedAt: new Date().toISOString(),
  };
  pipelines.set(pipelineId, status);
  
  try {
    logger.info({ pipelineId }, 'Extracting data');
    const csvData = await extract(source);
    
    logger.info({ pipelineId, rawRows: csvData.split('\n').length }, 'Transforming data');
    const transformed = transform(csvData);
    
    logger.info({ pipelineId, recordCount: transformed.length }, 'Loading data');
    await load(destination, transformed, pipelineId);
    
    status.status = 'completed';
    status.completedAt = new Date().toISOString();
    logger.info({ pipelineId, recordsProcessed: status.recordsProcessed, recordsFailed: status.recordsFailed }, 'Pipeline completed');
  } catch (error) {
    status.status = 'failed';
    status.errors.push(error instanceof Error ? error.message : String(error));
    status.completedAt = new Date().toISOString();
    logger.error({ pipelineId, error: status.errors }, 'Pipeline failed');
  }
  
  return pipelineId;
}
```

Now logs tell the story:
```json
{"level":"info","pipelineId":"abc123","source":"users.csv","destination":"users_db","msg":"Pipeline started"}
{"level":"info","pipelineId":"abc123","recordCount":1000,"msg":"Loading data"}
{"level":"info","pipelineId":"abc123","recordsProcessed":998,"recordsFailed":2,"msg":"Pipeline completed"}
```

**Ah.** 998 records processed, 2 failed. The pipeline completed successfully with error isolation.

## The Pain That Remains

You refactor `load()` and accidentally remove the duplicate-prevention check. The pipeline runs twice and creates duplicates. Your logs show two successful runs, but you don't have a test that verifies idempotency.

## What v5 Fixes

Testing. Every pipeline behavior needs a test.
