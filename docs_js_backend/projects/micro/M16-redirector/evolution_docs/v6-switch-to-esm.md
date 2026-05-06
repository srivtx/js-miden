# M16 Redirector — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your redirector still uses `require()`:

```js
const express = require('express');
const { isValidRedirectUrl } = require('./validator');
```

**Problems:**
1. No static analysis — your IDE can't reliably trace imports
2. Dynamic `require()` can load anything at runtime — harder to audit
3. Modern packages (including some Express 5 ecosystem tools) are ESM-only
4. Top-level await is impossible — you need async IIFEs for module-level setup
5. File extension confusion — `require('./validator')` resolves to `.js`, `.json`, or `.node` magically

## The Fix: ESM

```json
// package.json
{
  "name": "m16-redirector",
  "version": "1.0.0",
  "description": "Simple Redirector Microservice",
  "type": "module",
  "main": "dist/app.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/app.js",
    "dev": "tsx src/app.ts",
    "test": "vitest run"
  }
}
```

```ts
// app.ts
import express, { Request, Response } from 'express';
import { isValidRedirectUrl } from './validator.js';

export const app = express();
app.use(express.json());

app.post('/redirect', (req: Request, res: Response) => {
  const { url } = req.body;
  // ...
});

app.get('/info', (req: Request, res: Response) => {
  res.json({
    headers: req.headers,
    ip: req.ip,
    method: req.method,
    url: req.originalUrl,
  });
});

if (import.meta.url.endsWith(process.argv[1] ?? '')) {
  const PORT = process.env.PORT ?? 3000;
  app.listen(PORT, () => {
    console.log(`M16 Simple Redirector running on port ${PORT}`);
  });
}
```

**What ESM gives you:**
- Explicit imports — every dependency is declared at the top of the file
- File extensions required — no more guessing what `./validator` resolves to
- Future-proof — aligned with the direction of the Node.js ecosystem

## The Pain That Remains

You have TypeScript, validation, logging, tests, and ESM. But `app.ts` and `validator.ts` are in the project root, mixed with `package.json` and config files. Tests import from `../src/app.js` but the file is at `../app.js`. Time to clean up.

## What v7 Fixes

Final production setup. Proper `src/` directory, clean boundaries.
