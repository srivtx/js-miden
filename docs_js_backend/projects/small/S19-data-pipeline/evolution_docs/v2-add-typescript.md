# S19 Data Pipeline — v2 Add TypeScript

## The Bug: Types Catch Data Bugs

You add a transform step to your pipeline:

```js
function transform(records) {
  return records.map(row => ({
    id: row.id,
    name: row.name,
    email: row.email,
    age: parseInt(row.age, 10),
  }));
}
```

**The bug:** `row.age` might be `'invalid'`. `parseInt('invalid', 10)` returns `NaN`. Your database accepts it. Now `age` is `NaN` in production. Your analytics queries return `NULL` for half your users.

Another bug:
```js
function load(destination, records) {
  for (const record of records) {
    validateRecord(record);
  }
  db.insertBatch(records);
}
```

`validateRecord` throws on the first bad row. The entire batch fails. 999 good rows are rejected because of 1 bad row. Without types, you don't notice `validateRecord` throws until production.

## The Fix: Add TypeScript

```ts
// pipeline.ts
interface PipelineStatus {
  id: string;
  status: 'running' | 'completed' | 'failed';
  recordsProcessed: number;
  recordsFailed: number;
  errors: string[];
  startedAt: string;
  completedAt?: string;
}

interface Record {
  id: string;
  name: string;
  email: string;
  age: number;
}

export async function runPipeline(source: string, destination: string): Promise<string> {
  const pipelineId = uuid();
  const status: PipelineStatus = {
    id: pipelineId,
    status: 'running',
    recordsProcessed: 0,
    recordsFailed: 0,
    errors: [],
    startedAt: new Date().toISOString(),
  };
  // ...
}
```

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

**What TS catches:**
- `age: '30'` → compile error: `Type 'string' is not assignable to type 'number'`
- `status: 'done'` → compile error: not a valid PipelineStatus
- Missing `startedAt` → compile error: required field

## The Pain That Remains

TypeScript knows `age` is a `number`, but it doesn't enforce that `parseInt(row.age, 10)` produces a valid number. It doesn't know that `'invalid'` becomes `NaN`. We need runtime validation of the data itself.

## What v3 Fixes

Validation. Ensure every record is sane before it touches the database.
