# S19 Data Pipeline — v7 Production Setup

## Connect to src/

This is the final state. All evolutions converge into a clean, production-ready structure.

### Directory Structure

```
S19-data-pipeline/
├── src/
│   ├── index.ts            # Express routes + pipeline orchestration
│   ├── pipeline.ts         # ETL implementation
│   └── routes.ts           # HTTP endpoints
├── tests/
│   └── pipeline.test.ts    # Node.js test runner + assert
├── evolution_docs/         # This documentation
├── package.json
├── tsconfig.json
└── dist/                   # Compiled JS (gitignored)
```

### Key Production Decisions

**1. Extract-Transform-Load Separation**

```ts
// pipeline.ts
async function extract(source: string): Promise<string> {
  // Simulated CSV extraction
  return `id,name,email,age
1,Alice,alice@example.com,30
2,Bob,bob@example.com,25
3,Charlie,charlie@example,invalid
4,Dave,dave@example.com,35`;
}

function transform(data: string): Record[] {
  const records = parse(data, { columns: true, skip_empty_lines: true });
  return records.map((row: Record<string, string>) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    age: parseInt(row.age, 10),
  }));
}

async function load(destination: string, records: Record[], pipelineId: string): Promise<void> {
  // Error isolation: validate each record individually
  for (const record of records) {
    try {
      validateRecord(record);
      const existing = processedRecords.get(destination) || [];
      processedRecords.set(destination, [...existing, record]);
    } catch (error) {
      const status = pipelines.get(pipelineId);
      if (status) {
        status.recordsFailed++;
        status.errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }
}
```

Each phase is isolated. A failure in one phase doesn't corrupt another.

**2. Error Isolation**

```ts
for (const record of records) {
  try {
    validateRecord(record);
    // ... load record
  } catch (error) {
    // Log failure, increment counter, continue with next record
  }
}
```

One bad row does not fail the entire batch. Valid records are still processed.

**3. Pipeline Status Tracking**

```ts
interface PipelineStatus {
  id: string;
  status: 'running' | 'completed' | 'failed';
  recordsProcessed: number;
  recordsFailed: number;
  errors: string[];
  startedAt: string;
  completedAt?: string;
}
```

Every pipeline run has a unique ID and tracks progress. You can query `GET /pipeline/:id` to see exactly what happened.

**4. Self-execution Guard**

```ts
if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT);
}
```

Tests import `{ app }` without starting the server.

### The Intentional Bugs (For Learning)

The source code contains two commented-out bugs:

**Bug 1: Not Idempotent**
```ts
// BUG: Not idempotent - processed records stored without deduplication
const processedRecords: Map<string, Record[]> = new Map();
```

Re-running the pipeline with the same source creates duplicate records.

**Bug 2: No Error Isolation**
```ts
// BUG: No error isolation - one bad row fails entire batch
await load(destination, transformed, pipelineId);
```

The `load` function validates all records in a single loop. If `validateRecord` throws, the entire batch fails.

**Why are these here?** To demonstrate that a pipeline without tests is worse than no pipeline. The tests in `pipeline.test.ts` verify:
- Re-running should not create duplicates
- Bad rows should be isolated and counted

### Evolution Summary

| Version | Pain | Fix |
|---------|------|-----|
| v1 | Manual script, no error handling, no idempotency | Wrote naive JS |
| v2 | Type errors in data transformation | Added TypeScript |
| v3 | Invalid data reaching database | Added runtime validation |
| v4 | Silent pipeline failures | Added structured logging |
| v5 | Refactor breaks error isolation | Added comprehensive ETL tests |
| v6 | Legacy module system | Full ESM alignment |
| v7 | Disorganized project | Clean `src/` structure |

### Running the Final Version

```bash
npm install
npm run dev      # node --watch --loader ts-node/esm src/index.ts
npm run build    # tsc
npm start        # node dist/index.js
npm test         # node --test tests/**/*.test.ts
```

**Note:** This project uses the Node.js built-in test runner (not Jest/Vitest) to demonstrate native ESM + TypeScript testing without external test frameworks.
