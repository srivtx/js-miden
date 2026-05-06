# v6: Switch to ESM — API Gateway

## The Pain

You are using `http-proxy-middleware` which ships ESM-only. Your gateway is CJS. You get:

```
Error [ERR_REQUIRE_ESM]: require() of ES Module ... not supported
```

You try dynamic `import()` as a workaround:

```typescript
const { createProxyMiddleware } = await import('http-proxy-middleware');
```

Now your startup code is async, your tests need async setup, and your stack traces are worse. The workaround becomes the problem.

## The Solution

Go ESM-native from the start.

## Before (CJS workarounds)

```typescript
// src/index.ts
import express from 'express';
const { createProxyMiddleware } = require('./gateway'); // ESM-only package breaks
```

## After (ESM)

```json
// package.json
{
  "name": "m26-api-gateway",
  "type": "module",
  "main": "dist/index.js"
}
```

```typescript
// src/index.ts
import express from 'express';
import { createProxyMiddleware } from './gateway.js';
import { requestLogger } from './logger.js';
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

## Why ESM in 2025

The Express ecosystem is moving to ESM. `http-proxy-middleware` v3 is ESM-only. `pino` v9 is ESM-first. Using CJS in 2025 means fighting your dependencies.

## The Bug It Catches

In CJS, circular dependencies are "resolved" by returning an empty object for the not-yet-executed module:

```typescript
// logger.ts imports gateway.ts
// gateway.ts imports logger.ts
```

In CJS, one of them gets `{}`. In ESM, you get a clear `ReferenceError` at the point of use, making the circular dependency explicit and fixable.
