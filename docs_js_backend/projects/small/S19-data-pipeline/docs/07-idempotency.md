# 07-idempotency.md

## WHAT

Idempotency means re-running the pipeline produces the same result.

## WHY

Pipelines fail mid-run. Re-running should not create duplicates.

## HOW

Use unique keys and UPSERT:

```typescript
async function load(destination: string, records: Record[]): Promise<void> {
  for (const record of records) {
    await db.raw(`
      INSERT INTO ${destination} (id, name, email)
      VALUES (?, ?, ?)
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, email = EXCLUDED.email
    `, [record.id, record.name, record.email]);
  }
}
```

Track pipeline runs to prevent duplicate execution:
```typescript
if (await wasPipelineRun(source, destination)) {
  return { status: 'skipped', reason: 'already processed' };
}
```
