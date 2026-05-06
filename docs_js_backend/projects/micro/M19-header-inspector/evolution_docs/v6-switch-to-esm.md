# M19 Header Inspector — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your header inspector started with `require()`:

```js
const express = require('express');
const { extractClientIp } = require('./inspector');
```

**Problems:**
1. No static analysis — bundlers can't tree-shake unused exports
2. Dynamic resolution — `require('./inspector')` is opaque to tooling
3. Modern security libraries are ESM-only
4. `module.exports` vs `exports` confusion — subtle bugs

## The Fix: ESM

```json
// package.json
{
  "name": "m19-header-inspector",
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
// inspector.ts
import { Request, Response, NextFunction } from 'express';

const TRUSTED_PROXIES = (process.env.TRUSTED_PROXIES || '127.0.0.1').split(',');

export function setSecurityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

export function extractClientIp(req: Request) {
  // ...
}

export function analyzeSecurityHeaders(req: Request) {
  // ...
}
```

```ts
// index.ts
import express, { Request, Response } from 'express';
import { extractClientIp, analyzeSecurityHeaders, setSecurityHeaders } from './inspector.js';

const app = express();
app.use(express.json());
app.use(setSecurityHeaders);
// ...
export default app;
```

**What ESM gives you:**
- Named exports are explicit — `import { extractClientIp }` documents what's used
- File extensions required — `import './inspector.js'` is unambiguous
- Static analysis — security scanners can trace your imports

## The Pain That Remains

You have TypeScript, validation, logging, tests, and ESM. But `inspector.ts` mixes IP extraction, security header setting, and header analysis. `index.ts` is in the project root. Time to clean up.

## What v7 Fixes

Final production setup. Clean `src/` directory, proxy-aware IP extraction, response security headers.
