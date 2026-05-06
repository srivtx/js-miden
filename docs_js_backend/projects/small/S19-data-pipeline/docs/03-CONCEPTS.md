# 03-CONCEPTS.md

## WHAT: Data Pipeline Core Concepts

### Extract

```typescript
// WHAT: Read raw data from source systems
// WHY: Extraction should be fast and non-destructive
// HOW: Stream large files, handle failures with retry

async function extract(source: string): Promise<string> {
  // Simulated CSV extraction
  return `id,name,email,age
1,Alice,alice@example.com,30
2,Bob,bob@example.com,25
3,Charlie,charlie@example,invalid
4,Dave,dave@example.com,35`;
}
```

### Transform

```typescript
// WHAT: Validate, clean, normalize, and enrich data
// WHY: Raw data is often messy and inconsistent
// HOW: Schema validation, type casting, deduplication

function transform(data: string): Record[] {
  const records = parse(data, { columns: true, skip_empty_lines: true });
  
  return records.map((row: Record<string, string>) => ({
    id: row.id,
    name: row.name.trim(),
    email: row.email.toLowerCase(),
    age: parseInt(row.age, 10),
  }));
}
```

### Load

```typescript
// WHAT: Insert transformed data into the destination
// WHY: Loading should be efficient and safe
// HOW: Batch inserts, transactions, UPSERT for idempotency

async function load(destination: string, records: Record[]): Promise<LoadResult> {
  const results: LoadResult = { processed: 0, failed: 0, errors: [] };
  
  for (const record of records) {
    try {
      // UPSERT for idempotency
      await db.raw(`
        INSERT INTO ${destination} (id, name, email, age)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name, email = EXCLUDED.email, age = EXCLUDED.age
      `, [record.id, record.name, record.email, record.age]);
      
      results.processed++;
    } catch (error) {
      results.failed++;
      results.errors.push({ record: record.id, error: (error as Error).message });
    }
  }
  
  return results;
}
```

### Idempotency

```
WHAT: Running the pipeline twice produces the same result
WHY: Pipelines fail mid-run. Re-running should not create duplicates.
HOW: Unique keys + UPSERT

Pipeline Run 1:
  Alice -> INSERT -> Alice added
  Bob   -> INSERT -> Bob added
  (CRASHES halfway)

Pipeline Run 2:
  Alice -> UPSERT -> Alice updated (no duplicate)
  Bob   -> UPSERT -> Bob updated (no duplicate)
  Charlie -> INSERT -> Charlie added
  Dave -> INSERT -> Dave added

Result: Exactly 4 rows. No duplicates. Safe to retry.
```

## WHY: Error Isolation Matters

```
WRONG: All-or-nothing validation

function load(records) {
  for (const record of records) {
    validateRecord(record);  // Throws on first bad row!
  }
  saveAll(records);
}

Result:
  - Charlie has invalid email
  - Validation throws on row 3
  - Alice and Bob are NOT saved
  - Pipeline status: FAILED
  - 75% data loss for the day
```

```
RIGHT: Per-row error isolation

function load(records) {
  const results = { processed: 0, failed: 0, errors: [] };
  
  for (const record of records) {
    try {
      validateRecord(record);
      saveRecord(record);
      results.processed++;
    } catch (error) {
      results.failed++;
      results.errors.push({ id: record.id, error: error.message });
    }
  }
  
  return results;
}

Result:
  - Charlie has invalid email -> logged, skipped
  - Alice, Bob, Dave saved successfully
  - Pipeline status: COMPLETED (with 1 failure)
  - 0% unnecessary data loss
```

## HOW: Pipeline Status Tracking

```typescript
// WHAT: Monitor pipeline execution
// WHY: Operations teams need visibility into data freshness
// HOW: Track start time, end time, records processed/failed, errors

interface PipelineStatus {
  id: string;
  status: 'running' | 'completed' | 'failed';
  recordsProcessed: number;
  recordsFailed: number;
  errors: Array<{ record: string; error: string }>;
  startedAt: string;
  completedAt?: string;
}
```

## WRONG vs RIGHT: Pipeline Design

```typescript
// WRONG: No idempotency, no error isolation
async function runPipeline(source, destination) {
  const data = await extract(source);
  const records = transform(data);
  await saveAll(records);  // Fails entirely if one row is bad
}

// RIGHT: Idempotent with error isolation
async function runPipeline(source, destination) {
  const status = createStatus('running');
  
  try {
    const data = await extract(source);
    const records = transform(data);
    const result = await loadWithIsolation(destination, records);
    
    status.recordsProcessed = result.processed;
    status.recordsFailed = result.failed;
    status.errors = result.errors;
    status.status = 'completed';
  } catch (error) {
    status.status = 'failed';
    status.errors.push({ record: 'N/A', error: error.message });
  }
  
  return status;
}
```
