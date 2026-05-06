# M18 Timezone API — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your timezone API still has CJS traces:

```js
const express = require('express');
```

**Problems:**
1. No top-level await — can't precompute timezone lists at module load
2. Modern packages (date-fns-tz, luxon) are increasingly ESM-only
3. `__dirname` hacks for file paths — fragile and confusing
4. Dynamic `require()` can hide dependencies from static analysis

## The Fix: ESM

```json
// package.json
{
  "name": "m18-timezone-api",
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
// timezone.ts
const VALID_TIMEZONES = new Set(
  Intl.supportedValuesOf('timeZone')
);

export function isValidTimeZone(tz: string): boolean {
  return VALID_TIMEZONES.has(tz);
}
```

```ts
// index.ts
import express, { Request, Response } from 'express';
import { getCurrentTime, convertTime, isValidTimeZone } from './timezone.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// ...
app.listen(PORT, () => {
  console.log(`M18 Timezone API running on port ${PORT}`);
});

export default app;
```

**What ESM gives you:**
- `Intl.supportedValuesOf('timeZone')` computed at module load — no async needed
- Explicit imports — every dependency is visible
- File extensions required — no resolution magic

## The Pain That Remains

You have TypeScript, validation, logging, tests, and ESM. But `timezone.ts` mixes validation, formatting, and DST logic. `index.ts` mixes routes and server startup. Time to clean up.

## What v7 Fixes

Final production setup. Clean `src/` directory, IANA-backed validation, DST-aware conversion.
