# MD03 URL Shortener Pro — v6 Switching to ESM

## The Problem

You're trying to use `nanoid` for code generation. Version 5 is ESM-only.

```
Error [ERR_REQUIRE_ESM]: require() of ES Module nanoid not supported
```

You could use `nanoid` v3 (CommonJS), but v5 has better performance and smaller bundle size. You could use `crypto.randomUUID()`, but it doesn't produce URL-safe short codes.

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
// src/utils/codegen.ts
import { nanoid } from 'nanoid';

export function generateUniqueCode(): string {
  return nanoid(7); // 7 chars, URL-safe
}
```

```ts
// src/index.ts
import express from 'express';
import { UrlShortenerService } from './services/urlShortenerService.js';
import { PostgresUrlRepository } from './repos/postgresUrlRepo.js';
import { RedisCache } from './cache/redisCache.js';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const service = new UrlShortenerService(
  new PostgresUrlRepository(prisma),
  new RedisCache(),
);
```

## Why ESM Matters for This Project

### 1. Tree-Shaking Analytics Libraries

```ts
import { format, subDays } from 'date-fns';
import { groupBy } from 'lodash-es';
```

You only pay for what you use. Analytics dashboards are heavy. Tree-shaking keeps bundle size small.

### 2. Async Initialization

```ts
// src/cache/redisCache.ts
import Redis from 'ioredis';

export class RedisCache {
  private redis = new Redis(process.env.REDIS_URL);

  async warmCache(): Promise<void> {
    const popular = await this.getPopularUrls(1000);
    for (const { code, longUrl } of popular) {
      await this.redis.setex(`url:${code}`, 3600, longUrl);
    }
  }
}

// src/index.ts
const cache = new RedisCache();
await cache.warmCache(); // Top-level await
```

### 3. Conditional Imports for Dev Tools

```ts
if (process.env.NODE_ENV === 'development') {
  const { swaggerUi, swaggerSpec } = await import('./swagger.js');
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
```

ESM dynamic imports are cleaner than `require()` conditionals.

## Migration Checklist

- [ ] Add `"type": "module"` to `package.json`
- [ ] Use `.js` extensions in imports
- [ ] Use `node:` prefix for built-ins
- [ ] Update `tsconfig.json` for `NodeNext`
- [ ] Switch test runner to Vitest

## The Bug

You switch to ESM. Your `package.json` has `"main": "dist/index.js"`. But ESM requires `"exports"` or `"type": "module"`.

**Fix:**

```json
{
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

**Next:** Production setup with PostgreSQL, Redis caching, and cache stampede protection.
