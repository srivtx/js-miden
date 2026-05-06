# v6: Switch to ESM — Metrics Collector

## The Pain

CJS and ESM interoperability is broken. You install a modern package that only ships ESM. Your CJS project tries to `require()` it:

```
Error [ERR_REQUIRE_ESM]: require() of ES Module ... not supported
```

Now you are stuck. You cannot use the latest `pino` logger, the latest `got` HTTP client, or any package that has gone ESM-only.

## The Solution

Go ESM-native. Add `"type": "module"`, use `"module": "NodeNext"`, append `.js` to all relative imports.

## Before (CJS)

```json
// package.json
{
  "name": "m24-metrics-collector",
  "main": "dist/index.js"
}
```

```typescript
// src/index.ts
import express from 'express';
import { MetricsCollector } from './metrics-collector';
```

## After (ESM)

```json
// package.json
{
  "name": "m24-metrics-collector",
  "type": "module",
  "main": "dist/index.js"
}
```

```typescript
// src/index.ts
import express from 'express';
import { MetricsCollector } from './metrics-collector.js';
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

## The Bug It Catches

In CJS, this compiles and runs but does the wrong thing:

```typescript
import { getMetrics } from './metrics';
```

If `metrics.ts` and `metrics-collector.ts` both exist, CJS might load the wrong one depending on `package.json` or directory structure. ESM forces the exact filename, eliminating silent import bugs.

## Why ESM in 2025

The npm ecosystem is splitting. New packages are ESM-only. Staying on CJS means dependency rot. In 2025, ESM is the default assumption for any new Node.js project.
