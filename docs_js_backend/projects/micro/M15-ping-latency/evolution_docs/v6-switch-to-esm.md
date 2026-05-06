# M15 Ping API — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your project uses `require()` and `module.exports`:

```js
// CommonJS — works, but dated
const express = require('express');
const { measureLatency } = require('./latency');

module.exports = { app };
```

**Problems:**
1. No top-level await — you must wrap async code in IIFEs
2. `require()` loads synchronously and caches aggressively — hard to mock in tests
3. Named exports are fragile — `module.exports.foo = ...` vs `exports.foo = ...`
4. Modern packages (many Express 5 middlewares) ship ESM-only
5. `__dirname` and `__filename` are CJS-only; you need `import.meta.url` workarounds

## The Fix: ESM

```json
// package.json
{
  "type": "module",
  "scripts": {
    "dev": "tsx src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js",
    "test": "vitest run"
  }
}
```

```ts
// app.ts — ESM with explicit imports
import express, { Request, Response } from 'express';
import { measureLatency } from './latency.js'; // .js extension required in ESM

export const app = express();

app.get('/latency', async (req: Request, res: Response) => {
  // ...
});

if (import.meta.url.endsWith(process.argv[1] ?? '')) {
  const PORT = process.env.PORT ?? 3000;
  app.listen(PORT, () => {
    console.log(`M15 Ping API running on port ${PORT}`);
  });
}
```

**What ESM gives you:**
- Static analysis — bundlers and IDEs know your dependency graph
- Explicit file extensions — no more `Cannot find module './latency'` because you forgot the extension
- Modern Node.js alignment — the ecosystem is moving to ESM

## The Pain That Remains

You have TypeScript, validation, logging, tests, and ESM. But the project structure is a mess. Source files are in root, tests are scattered, and `tsconfig.json` might be compiling tests into `dist/`. Time to productionize.

## What v7 Fixes

Final production setup. Proper `src/` directory, clean `tsconfig.json`, environment-based port config.
