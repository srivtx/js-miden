# M30 Bulkhead — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your project uses `require()` and `module.exports`:

```js
// CommonJS — works, but dated
const express = require('express');
const { executeWithPool } = require('./bulkhead');

module.exports = { app };
```

**Problems:**
1. No top-level await — you must wrap async code in IIFEs
2. `require()` loads synchronously and caches aggressively — hard to mock in tests
3. Named exports are fragile — `module.exports.foo = ...` vs `exports.foo = ...`
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
import { executeWithPool } from './bulkhead.js';

export const app = express();

app.get('/critical', async (req: Request, res: Response) => {
  try {
    const result = await executeWithPool('critical', async () => {
      await new Promise(r => setTimeout(r, 100));
      return { type: 'critical', status: 'ok' };
    });
    res.json(result);
  } catch (err: any) {
    res.status(503).json({ error: err.message });
  }
});

if (import.meta.url.endsWith(process.argv[1] ?? '')) {
  const PORT = process.env.BULKHEAD_PORT ?? 3000;
  app.listen(PORT, () => {
    console.log(`Bulkhead Server running on port ${PORT}`);
  });
}
```

**What ESM gives you:**
- Static analysis — bundlers and IDEs know your dependency graph
- Explicit file extensions — no more `Cannot find module './bulkhead'`
- Modern Node.js alignment — the ecosystem is moving to ESM

## The Pain That Remains

You have TypeScript, validation, logging, tests, and ESM. But the pools are still hardcoded. There's no queue limits, no priority queues, and no adaptive sizing. Time to productionize.

## What v7 Fixes

Final production setup. Separate pools, queue limits, priority queues, and adaptive sizing.
