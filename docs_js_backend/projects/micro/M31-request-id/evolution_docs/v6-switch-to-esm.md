# M31 Request ID — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your project uses `require()` and `module.exports`:

```js
// CommonJS — works, but dated
const express = require('express');
const { requestIdMiddleware } = require('./requestId');

module.exports = app;
```

**Problems:**
1. No top-level await — you must wrap async code in IIFEs
2. `require()` loads synchronously and caches aggressively — hard to mock in tests
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
import express, { Request, Response, NextFunction } from 'express';
import { requestIdMiddleware } from './requestId.js';
import { logger } from './logger.js';
import { proxyMiddleware } from './proxy.js';

const app = express();

app.use(requestIdMiddleware);

app.get('/health', (req: Request, res: Response) => {
  logger.info(req, 'health check');
  res.json({ status: 'ok' });
});

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(3000, () => console.log('M31 listening on :3000'));
}

export default app;
```

**What ESM gives you:**
- Static analysis — bundlers and IDEs know your dependency graph
- Explicit file extensions — no more `Cannot find module './requestId'`
- Modern Node.js alignment — the ecosystem is moving to ESM

## The Pain That Remains

You have TypeScript, validation, logging, tests, and ESM. But the request ID is only local. When you call downstream services, they generate their own IDs. You can't trace a single transaction across the system. Time to productionize.

## What v7 Fixes

Final production setup. UUID v4 generation, correlation across services, and guaranteed header propagation.
