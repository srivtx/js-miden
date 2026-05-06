# v6: Switch to ESM — Load Balancer

## The Pain

Your load balancer uses `__dirname` to resolve the path to `backends.json`. In ESM, `__dirname` does not exist.

```
ReferenceError: __dirname is not defined in ES module scope
```

You try `import.meta.url`, but your project is CJS and `import.meta` is a syntax error. You are trapped between two module systems.

## The Solution

Switch fully to ESM. Replace `__dirname` with `fileURLToPath(import.meta.url)`.

## Before (CJS)

```typescript
// src/balancer.ts
import path from 'path';
const backendsPath = path.join(__dirname, 'backends.json');
```

## After (ESM)

```json
// package.json
{
  "name": "m27-load-balancer",
  "type": "module",
  "main": "dist/index.js"
}
```

```typescript
// src/balancer.ts
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendsPath = path.join(__dirname, 'backends.json');
```

```typescript
// src/index.ts
import express from 'express';
import { selectBackend } from './balancer.js';
import { startHealthChecks } from './health.js';
```

## Why ESM in 2025

`import.meta.url` is the universal module reference. It works in browsers, Node, Deno, and Bun. `__dirname` is Node CJS-only. ESM makes your code portable.

## The Bug It Catches

CJS allows you to accidentally use a global that doesn't exist in other environments:

```typescript
console.log(__dirname); // works in Node CJS, undefined in browser
```

ESM forces you to explicitly construct paths, making your code environment-agnostic and preventing hidden platform assumptions.
