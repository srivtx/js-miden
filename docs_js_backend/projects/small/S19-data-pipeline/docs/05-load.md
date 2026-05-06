# 05-load.md

## WHAT

Load inserts transformed data into the destination.

## WHY

Loading should be efficient and safe. Use transactions and batch inserts.

## HOW

```typescript
async function load(destination: string, records: Record[]): Promise<void> {
  const batchSize = 1000;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await db.insert(batch).into(destination);
  }
}
```

Use UPSERT for idempotency:
```sql
INSERT INTO users (id, name, email) VALUES (?, ?, ?)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email;
```
