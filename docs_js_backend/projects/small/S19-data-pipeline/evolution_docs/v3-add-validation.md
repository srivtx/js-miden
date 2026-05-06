# S19 Data Pipeline — v3 Add Validation

## The Bug: Validation Catches Data Bugs

Your TypeScript pipeline accepts any CSV data:

```ts
function transform(data: string): Record[] {
  const records = parse(data, { columns: true, skip_empty_lines: true });
  return records.map((row: Record<string, string>) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    age: parseInt(row.age, 10),
  }));
}
```

Without validation:
- `age: NaN` — `parseInt('invalid', 10)` produces `NaN`, which passes TypeScript
- `email: 'not-an-email'` — TypeScript says it's a `string`, but it's not a valid email
- `id: ''` — empty string is still a `string`
- `name: undefined` — if the column is missing, `row.name` is `undefined`

All of these make it into your database because TypeScript doesn't validate data at runtime.

## The Fix: Runtime Record Validation

```ts
function validateRecord(record: Record): void {
  if (!record.id || typeof record.id !== 'string') {
    throw new Error(`Invalid id: ${record.id}`);
  }
  if (!record.name || typeof record.name !== 'string') {
    throw new Error(`Invalid name: ${record.name}`);
  }
  if (!record.email || !record.email.includes('@')) {
    throw new Error(`Invalid email: ${record.email}`);
  }
  if (isNaN(record.age) || record.age < 0 || record.age > 150) {
    throw new Error(`Invalid age: ${record.age}`);
  }
}
```

```ts
async function load(destination: string, records: Record[], pipelineId: string): Promise<void> {
  const valid: Record[] = [];
  const invalid: string[] = [];

  for (const record of records) {
    try {
      validateRecord(record);
      valid.push(record);
    } catch (error) {
      invalid.push(error instanceof Error ? error.message : String(error));
    }
  }

  const existing = processedRecords.get(destination) || [];
  processedRecords.set(destination, [...existing, ...valid]);

  const status = pipelines.get(pipelineId);
  if (status) {
    status.recordsProcessed += valid.length;
    status.recordsFailed += invalid.length;
    status.errors.push(...invalid);
  }
}
```

**What validation prevents:**
- `NaN` ages are caught before the database
- Invalid emails are isolated as failed records
- Empty IDs are rejected
- The pipeline reports how many succeeded and how many failed

## The Pain That Remains

You validate records, but you still have no visibility into pipeline runs. When a pipeline fails at 3 AM, you don't know until a user complains. There's no logging of start times, end times, or failure counts.

## What v4 Fixes

Logging. Observe pipeline behavior in production.
