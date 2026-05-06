# MD01 E-Commerce Cart — v6 Switching to ESM

## The Problem

You're trying to use `ioredis` for cart caching. It's ESM-only.

```
Error [ERR_REQUIRE_ESM]: require() of ES Module ioredis not supported
```

You could use the older `redis` package (CommonJS), but `ioredis` has better cluster support and TypeScript types. You could dynamic-import it, but then your codebase is a Frankenstein of `require` and `import`.

## The Fix: Go All-In on ESM

```json
// package.json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest"
  }
}
```

```ts
// src/index.ts
import express from 'express';
import { CartService } from './services/cartService.js';
import { PostgresCartRepository } from './repos/postgresCartRepo.js';
import { RedisCartCache } from './cache/redisCartCache.js';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const cartService = new CartService(
  new PostgresCartRepository(prisma),
  new RedisCartCache(),
);
```

Notice the `.js` extensions in imports. TypeScript compiles to `.js`, and ESM requires explicit extensions.

## Why ESM Matters for This Project

### 1. Tree Shaking

Your cart service imports lodash for deep cloning. With ESM, bundlers can tree-shake unused functions:

```ts
import { cloneDeep } from 'lodash-es'; // ESM version
```

### 2. Top-Level Await

```ts
// src/index.ts
const redis = new Redis(process.env.REDIS_URL);
await redis.ping(); // Ensure connection before starting server

app.listen(3000);
```

No more `connect().then(() => app.listen())` wrappers.

### 3. Named Imports from Prisma

```ts
import { PrismaClient, CartStatus } from '@prisma/client';
```

Prisma generates ESM-friendly types. Named imports work cleanly.

## Migration Checklist

- [ ] Add `"type": "module"` to `package.json`
- [ ] Rename all imports to use `.js` extensions
- [ ] Use `node:` prefix for built-ins (`node:crypto`, `node:fs`)
- [ ] Replace `__dirname` with `import.meta.url`
- [ ] Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "esModuleInterop": true
  }
}
```

## The Bug

You switch to ESM. Your test runner (Jest) breaks. Jest's ESM support is experimental. You spend a day fighting config.

**Fix:** Use Vitest. It supports ESM natively.

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

**Next:** Production setup with PostgreSQL, Prisma, Redis, and transactions.
