# 06-error-handling.md

## WHAT

Errors should be isolated so one bad row doesn't fail the entire batch.

## WHY

Real data is dirty. Failing the entire batch for one error is unacceptable.

## HOW

```typescript
async function loadWithIsolation(records: Record[]): Promise<LoadResult> {
  const results = { processed: 0, failed: 0, errors: [] };
  
  for (const record of records) {
    try {
      await loadRecord(record);
      results.processed++;
    } catch (error) {
      results.failed++;
      results.errors.push({ record: record.id, error: error.message });
    }
  }
  
  return results;
}
```

Log failed rows to a dead-letter queue for manual review.
