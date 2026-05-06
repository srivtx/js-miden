# 09-bugs.md

## WHAT

Two intentional bugs demonstrate common ETL pitfalls.

## WHY

Non-idempotent pipelines and no error isolation cause data corruption and operational pain.

## HOW

### Bug 1: Not Idempotent

**Symptom**: Re-running pipeline creates duplicate records.

**Impact**: Data quality degrades. Analytics are wrong.

**Fix**: Use UPSERT or track processed source files:

```typescript
for (const record of records) {
  await db.raw(`
    INSERT INTO destination (id, name, email)
    VALUES (?, ?, ?)
    ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name
  `, [record.id, record.name, record.email]);
}
```

### Bug 2: No Error Isolation

**Symptom**: One bad row throws and fails the entire batch.

**Impact**: Entire pipeline fails. Good data is not loaded.

**Fix**: Wrap each row in try/catch:

```typescript
for (const record of records) {
  try {
    await loadRecord(record);
    status.processed++;
  } catch (error) {
    status.failed++;
    status.errors.push({ id: record.id, error: error.message });
  }
}
```
