# M32 Content Negotiation — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your project uses `require()` and `module.exports`:

```js
// CommonJS — works, but dated
const express = require('express');
const { formatResponse } = require('./formatters');

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
import { parseAcceptHeader, selectFormat, SupportedFormat } from './negotiator.js';
import { formatResponse } from './formatters.js';

const app = express();
const supportedFormats: SupportedFormat[] = ['json', 'xml', 'html', 'text'];

app.use((req: Request, res: Response, next: NextFunction) => {
  res.negotiate = (data: unknown, status = 200) => {
    const accept = req.get('Accept') || '*/*';
    const items = parseAcceptHeader(accept);
    const format = selectFormat(items, supportedFormats) || 'json';
    const { body, contentType } = formatResponse(data, format);
    res.setHeader('Content-Type', contentType);
    res.status(status).send(body);
  };
  next();
});

app.get('/resource', (req: Request, res: Response) => {
  res.negotiate({ message: 'Hello' });
});

export default app;

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(3000, () => console.log('M32 listening on :3000'));
}
```

**What ESM gives you:**
- Static analysis — bundlers and IDEs know your dependency graph
- Explicit file extensions
- Modern Node.js alignment

## The Pain That Remains

You have TypeScript, validation, logging, tests, and ESM. But wildcard handling is broken. `*/*` returns `null` from `selectFormat`. Quality values are parsed but not respected in edge cases. Time to productionize.

## What v7 Fixes

Final production setup. Full Accept parsing, quality values, wildcard handling, and extensible formatters.
