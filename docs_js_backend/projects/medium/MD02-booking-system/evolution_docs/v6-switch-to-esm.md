# MD02 Booking System — v6 Switching to ESM

## The Problem

You're trying to use `date-fns` for calendar calculations. It's ESM-only.

```
Error [ERR_REQUIRE_ESM]: require() of ES Module date-fns not supported
```

You could write your own date math, but `date-fns` handles DST, leap years, and locale formatting correctly. You could dynamic-import it, but that breaks tree-shaking.

## The Fix: Go All-In on ESM

```json
// package.json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest",
    "db:migrate": "prisma migrate dev"
  }
}
```

```ts
// src/index.ts
import express from 'express';
import { BookingService } from './services/bookingService.js';
import { PrismaBookingRepository } from './repos/prismaBookingRepo.js';
import { RedisHoldManager } from './services/redisHoldManager.js';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const bookingService = new BookingService(
  new PrismaBookingRepository(prisma),
  new RedisHoldManager(),
);
```

## Why ESM Matters for This Project

### 1. Tree-Shaking Date Utilities

```ts
import { addMinutes, isBefore, formatISO } from 'date-fns';

const endTime = addMinutes(startTime, durationMinutes);
if (isBefore(endTime, startTime)) {
  throw new Error('Invalid duration');
}
```

ESM bundlers include only the functions you use. No 50KB `date-fns` bundle.

### 2. Async Module Initialization

```ts
// src/services/redisHoldManager.ts
import Redis from 'ioredis';

export class RedisHoldManager {
  private redis = new Redis(process.env.REDIS_URL);

  async initialize() {
    // Test connection
    await this.redis.ping();
    // Load active holds from DB on startup
    await this.hydrateHolds();
  }
}

// src/index.ts
const holdManager = new RedisHoldManager();
await holdManager.initialize(); // Top-level await
```

### 3. Named Imports from Prisma

```ts
import { PrismaClient, BookingStatus } from '@prisma/client';

// Type-safe enums
const status: BookingStatus = 'confirmed';
```

## Migration Checklist

- [ ] Add `"type": "module"` to `package.json`
- [ ] Use `.js` extensions in all imports
- [ ] Use `node:` prefix for built-ins
- [ ] Replace `__dirname` with `import.meta.url`
- [ ] Update test runner to Vitest for native ESM

## The Bug

You switch to ESM. Your `ts-node` dev setup breaks. `ts-node` with ESM is painful.

**Fix:** Use `tsx`.

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts"
  }
}
```

`tsx` handles ESM TypeScript without config files.

**Next:** Production setup with PostgreSQL, Prisma migrations, and Redis holds.
