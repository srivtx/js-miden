# v6-switch-to-esm.md — "My imports are a mess"

## The Bug

You're using CommonJS:

```js
const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');

module.exports = { app };
```

You need to conditionally load a mock Redis client for tests:

```js
let redis;
if (process.env.NODE_ENV === 'test') {
  redis = require('./mock-redis');
} else {
  redis = require('./redis');
}
```

This works, but it's synchronous. You want to lazy-load:

```js
const redis = process.env.NODE_ENV === 'test'
  ? await import('./mock-redis.js')
  : await import('./redis.js');
```

CommonJS `require` doesn't support top-level await. You wrap everything in an async IIFE. Your exports are broken.

## The 3am Page, Redux

You have a circular dependency between `health.js` and `db.js`:

```js
// health.js
const { db } = require('./db');

// db.js
const { checkHealth } = require('./health');
```

CommonJS returns an incomplete object for circular requires. `db` is `{}` when `health.js` loads. Your health check crashes with `db.query is not a function`.

You spend an hour renaming files and moving `require` calls to the bottom of files. ESM handles this more gracefully because imports are resolved statically.

## Why ESM?

- **Top-level await** — conditionally load modules, connect to services at boot
- **Static analysis** — IDEs and bundlers understand your dependency graph
- **Named exports** — explicit contracts between modules
- **Dynamic imports** — `await import('./module.js')` works natively
- **Node.js default** — Node 20+ prefers ESM. CommonJS is legacy.

## The Migration

### 1. Add `"type": "module"` to `package.json`

```json
{
  "name": "m03-health-check",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
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
const { Pool } = require('pg');
const Redis = require('ioredis');

// After
import express from 'express';
import { Pool } from 'pg';
import Redis from 'ioredis';
```

### 3. Change `module.exports` to `export`

```ts
// Before
module.exports = { app };
module.exports.checkHealth = checkHealth;

// After
export const app = express();
export async function checkHealth(): Promise<HealthStatus> { ... }
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
import { checkHealth } from './health';
import { db } from './db';

// After
import { checkHealth } from './health.js';
import { db } from './db.js';
```

## What Changed

- `"type": "module"` in `package.json`
- `require` → `import`
- `module.exports` → `export`
- `tsconfig.json` uses `"module": "NodeNext"`
- Relative imports include `.js` extension
- Top-level await available for config loading

## What We Still Need

We've built a typed, validated, tested, ESM application. Now we need to see the final structure and understand how all the pieces fit together.

For that, we need the production setup.
