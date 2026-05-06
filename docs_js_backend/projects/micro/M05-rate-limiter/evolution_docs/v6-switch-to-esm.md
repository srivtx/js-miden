# v6-switch-to-esm.md — "My imports are a mess"

## The Bug

You're using CommonJS:

```js
const express = require('express');
const { Redis } = require('ioredis');

module.exports = { app, rateLimiter };
```

You need to share the Redis instance between the rate limiter and a caching layer:

```js
// redis.js
const { Redis } = require('ioredis');
module.exports = new Redis({ ... });

// rate-limiter.js
const redis = require('./redis');

// cache.js
const redis = require('./redis');
```

This works in CommonJS because `require` caches the module. Both files get the same instance. But with ESM, you want to be explicit:

```ts
// redis.ts
import { Redis } from 'ioredis';
export const redis = new Redis({ ... });

// rate-limiter.ts
import { redis } from './redis.js';

// cache.ts
import { redis } from './redis.js';
```

ESM also caches modules, but the syntax is clearer: you're importing a named export, not a module object.

## The 3am Page, Redux

You try to use dynamic import for the rate limiter config:

```js
const config = process.env.NODE_ENV === 'test'
  ? require('./test-config')
  : require('./prod-config');
```

This is synchronous. If the config file is large, it blocks the event loop. You want:

```ts
const config = await import(
  process.env.NODE_ENV === 'test' ? './test-config.js' : './prod-config.js'
);
```

CommonJS doesn't support top-level await. ESM does.

## Why ESM?

- **Named exports** — explicit sharing of the Redis instance
- **Top-level await** — async config loading without blocking
- **Static analysis** — bundlers understand the dependency graph
- **Dynamic imports** — conditionally load modules
- **Node.js default** — Node 20+ prefers ESM. CommonJS is legacy.

## The Migration

### 1. Add `"type": "module"` to `package.json`

```json
{
  "name": "m05-rate-limiter",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

### 2. Change `require` to `import`

```ts
// Before
const express = require('express');
const { Redis } = require('ioredis');

// After
import express from 'express';
import { Redis } from 'ioredis';
```

### 3. Change `module.exports` to `export`

```ts
// Before
module.exports = { app };
module.exports.rateLimiter = rateLimiter;

// After
export const app = express();
export async function rateLimiter(req, res, next) { ... }
```

### 4. Update `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true
  }
}
```

### 5. Add `.js` to relative imports

```ts
// Before
import { rateLimiter } from './rate-limiter';

// After
import { rateLimiter } from './rate-limiter.js';
```

## What Changed

- `"type": "module"` in `package.json`
- `require` → `import`
- `module.exports` → `export`
- `tsconfig.json` uses `"module": "NodeNext"`
- Relative imports include `.js` extension
- Named exports make shared dependencies explicit

## What We Still Need

We've built a typed, validated, tested, ESM application. Now we need to see the final structure and understand how all the pieces fit together.

For that, we need the production setup.
