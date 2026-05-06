# M29 Config Server — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your project uses `require()` and `module.exports`:

```js
// CommonJS — works, but dated
const express = require('express');
const { setConfig, getConfig } = require('./config');

module.exports = { app };
```

**Problems:**
1. No top-level await — you must wrap async code in IIFEs
2. `require()` loads synchronously and caches aggressively — hard to mock in tests
3. Named exports are fragile — `module.exports.foo = ...` vs `exports.foo = ...`
4. Modern packages ship ESM-only
5. `__dirname` and `__filename` are CJS-only; you need `import.meta.url` workarounds

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
import { setConfig, getConfig } from './config.js'; // .js extension required in ESM

export const app = express();

app.post('/config/:app/:env', (req: Request, res: Response) => {
  // ...
});

if (import.meta.url.endsWith(process.argv[1] ?? '')) {
  const PORT = process.env.CONFIG_PORT ?? 3000;
  app.listen(PORT, () => {
    console.log(`Config Server running on port ${PORT}`);
  });
}
```

**What ESM gives you:**
- Static analysis — bundlers and IDEs know your dependency graph
- Explicit file extensions — no more `Cannot find module './config'` because you forgot the extension
- Modern Node.js alignment — the ecosystem is moving to ESM

## The Pain That Remains

You have TypeScript, validation, logging, tests, and ESM. But the config is still in-memory. On restart, everything is lost. There's no versioning, no encryption, and no environment isolation beyond the code. Time to productionize.

## What v7 Fixes

Final production setup. Persistent storage, versioning, encryption, and atomic updates.
