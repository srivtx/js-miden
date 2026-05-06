# M34 Validate Headers — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your project uses `require()` and `module.exports`:

```js
// CommonJS — works, but dated
const express = require('express');
const { validateHeaders } = require('./validator');

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
import express, { Request, Response, NextFunction } from 'express';
import { validateHeaders, defaultRules } from './validator.js';

const app = express();
app.use(express.json());
app.use(validateHeaders(defaultRules, 'lenient'));

app.get('/public', (req: Request, res: Response) => {
  res.json({ message: 'public endpoint', warnings: (req as any).headerWarnings });
});

app.post(
  '/private',
  validateHeaders(
    [
      ...defaultRules,
      { name: 'X-Custom-Token', required: true, pattern: /^[A-Z0-9]{32}$/ },
    ],
    'strict'
  ),
  (req: Request, res: Response) => {
    res.json({ message: 'private endpoint' });
  }
);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.status || 500).json({ error: err.message, details: err.details });
});

export default app;

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(3000, () => console.log('M34 listening on :3000'));
}
```

**What ESM gives you:**
- Static analysis
- Explicit file extensions
- Modern Node.js alignment

## The Pain That Remains

You have TypeScript, validation, logging, tests, and ESM. But header lookup is still case-sensitive. RFC 2616 says headers are case-insensitive. Time to productionize.

## What v7 Fixes

Final production setup. Case-insensitive header lookup, RFC compliance, and configurable rules.
