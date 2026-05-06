# M17 CSV Parser — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your CSV parser uses `require()`:

```js
const express = require('express');
const { parseCsvSafe } = require('./parser');
```

**Problems:**
1. No top-level await — can't do async module initialization
2. Dynamic resolution — `require('./parser')` could resolve to `.js`, `.json`, or `.node`
3. Modern packages are ESM-only — you'll hit compatibility issues
4. Tree shaking is impossible — bundlers can't eliminate dead code

## The Fix: ESM

```json
// package.json
{
  "name": "m17-csv-parser",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

```ts
// index.ts
import express, { Request, Response } from 'express';
import { parseCsvSafe } from './parser.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.post('/upload-csv', async (req: Request, res: Response) => {
  // ...
});

app.listen(PORT, () => {
  console.log(`M17 CSV Parser API running on port ${PORT}`);
});

export default app;
```

**What ESM gives you:**
- Explicit file extensions — `import { parseCsvSafe } from './parser.js'`
- Static analysis — tools know your dependency graph
- Future-proof — aligned with Node.js ecosystem direction

## The Pain That Remains

You have TypeScript, validation, logging, tests, and ESM. But `index.ts` mixes route handling with server startup. `parser.ts` is in the project root. There's no clean separation. Time to productionize.

## What v7 Fixes

Final production setup. Clean `src/` directory, explicit interfaces, proper boundaries.
