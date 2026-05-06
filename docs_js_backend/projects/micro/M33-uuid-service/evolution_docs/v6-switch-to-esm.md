# M33 UUID Service — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your project uses `require()` and `module.exports`:

```js
// CommonJS — works, but dated
const express = require('express');
const { uuidV4 } = require('./uuid');

module.exports = app;
```

**Problems:**
1. No top-level await
2. `require()` loads synchronously and caches aggressively
3. Named exports are fragile
4. Modern packages ship ESM-only
5. `__dirname` and `__filename` are CJS-only

## The Fix: ESM

```json
// package.json
{
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

```ts
// index.ts — ESM with explicit imports
import express, { Request, Response } from 'express';
import { uuidV4, uuidV7, ulid, bulkGenerate } from './uuid.js';

const app = express();
app.use(express.json());

app.get('/uuid/v4', (_req: Request, res: Response) => {
  res.json({ uuid: uuidV4() });
});

app.get('/uuid/v7', (_req: Request, res: Response) => {
  res.json({ uuid: uuidV7() });
});

app.get('/uuid/ulid', (_req: Request, res: Response) => {
  res.json({ ulid: ulid() });
});

app.post('/uuid/bulk', (req: Request, res: Response) => {
  const { count = 1, type = 'v4' } = req.body;
  const n = Math.min(Math.max(parseInt(count, 10) || 1, 1), 1000);
  const results = bulkGenerate(n, type as 'v4' | 'v7' | 'ulid');
  res.json({ count: n, type, results });
});

export default app;

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(3000, () => console.log('M33 listening on :3000'));
}
```

**What ESM gives you:**
- Static analysis
- Explicit file extensions
- Modern Node.js alignment

## The Pain That Remains

You have TypeScript, validation, logging, tests, and ESM. But the v7 timestamp is still wrong. There's no bulk validation. Time to productionize.

## What v7 Fixes

Final production setup. Multiple UUID versions, bulk generation, validation, and correct timestamps.
