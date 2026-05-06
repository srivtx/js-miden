# S19 Data Pipeline — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your pipeline project uses a mix:

```json
// package.json
"type": "module",
"test": "node --test tests/**/*.test.ts"
```

**Problems:**
1. Node.js test runner with TypeScript requires loaders or transpilation
2. `require()` might still exist in test setup files
3. No top-level await — can't initialize pipeline config from an async source
4. File extensions are implicit — `import './pipeline'` might resolve to `.js` or `.ts` unpredictably

## The Fix: Full ESM Alignment

The project already has `"type": "module"` in `package.json`. The final step is aligning everything:

```json
// package.json
{
  "name": "s19-data-pipeline",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "node --watch --loader ts-node/esm src/index.ts",
    "test": "node --test tests/**/*.test.ts"
  }
}
```

```ts
// pipeline.ts
import { parse } from 'csv-parse/sync';
import { v4 as uuid } from 'uuid';

export interface PipelineStatus {
  id: string;
  status: 'running' | 'completed' | 'failed';
  recordsProcessed: number;
  recordsFailed: number;
  errors: string[];
  startedAt: string;
  completedAt?: string;
}

export interface Record {
  id: string;
  name: string;
  email: string;
  age: number;
}

export async function runPipeline(source: string, destination: string): Promise<string> {
  // ...
}
```

```ts
// index.ts
import express from 'express';
import { pipelineRouter } from './routes.js';

const app = express();
app.use(express.json());
app.use('/pipeline', pipelineRouter);

export { app };

if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Data pipeline service running on port ${PORT}`);
  });
}
```

**What full ESM gives you:**
- No `--loader` hacks in production
- `import.meta.url` for self-execution guards
- Named exports are first-class — `export { app, runPipeline }`
- File extensions are explicit — `./routes.js`

## The Pain That Remains

You have TypeScript, validation, logging, tests, and ESM. But `pipeline.ts` mixes extraction, transformation, and loading. `index.ts` mixes HTTP routing with pipeline orchestration. Time to clean up.

## What v7 Fixes

Final production setup. Clean `src/` directory, proper ETL separation, and idempotency.
