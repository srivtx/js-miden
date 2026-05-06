# M35 Timezone API — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your project uses `require()` and `module.exports`:

```js
// CommonJS — works, but dated
const express = require('express');
const { convertTime } = require('./timezone');

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
import { convertTime, listTimezones } from './timezone.js';

const app = express();

app.get('/convert', (req: Request, res: Response) => {
  const { from, to, time } = req.query;

  if (!from || !to || !time) {
    res.status(400).json({ error: 'Missing required query parameters: from, to, time' });
    return;
  }

  try {
    const result = convertTime(String(from), String(to), String(time));
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/timezones', (_req: Request, res: Response) => {
  res.json({ timezones: listTimezones() });
});

export default app;

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(3000, () => console.log('M35 listening on :3000'));
}
```

**What ESM gives you:**
- Static analysis
- Explicit file extensions
- Modern Node.js alignment

## The Pain That Remains

You have TypeScript, validation, logging, tests, and ESM. But the conversion still uses a fixed offset table. DST transitions are wrong. IANA zones aren't supported. Time to productionize.

## What v7 Fixes

Final production setup. Intl API, IANA zones, and correct DST transitions.
