# v2-add-typescript.md — "I passed the wrong field name"

## The Bug

You're building a health check. It returns a status object. The ops team expects a specific shape for their monitoring dashboard.

```js
app.get('/health', async (req, res) => {
  const dbStatus = await checkDatabase();
  const redisStatus = await checkRedis();

  res.json({
    statu: dbStatus && redisStatus ? 'healthy' : 'unhealthy',
    cheks: { database: dbStatus, redis: redisStatus },
  });
});
```

`statu`. `cheks`.

The monitoring dashboard shows `undefined` for status. It triggers a critical alert at 3am. You wake up, check the server, everything is fine. The dashboard is looking for `status`, but you sent `statu`.

JavaScript doesn't care. JSON serialization is happy to produce `{ statu: "healthy", cheks: { ... } }`.

## The 3am Page, Redux

Later, someone adds a new dependency check:

```js
res.json({
  status: 'healthy',
  checks: {
    database: dbStatus,
    redis: redisStatus,
    s3: s3Status,
  },
  timestmap: new Date().toISOString(), // typo
});
```

The ops dashboard now shows a timestamp of `undefined`. They think the health check is stale and restart the server repeatedly. The real issue was a typo.

## Adding TypeScript

```bash
npm install -D typescript @types/node @types/express @types/pg tsx
```

```ts
// src/health.ts
export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  checks: {
    database: string;
    redis: string;
  };
}
```

```ts
// src/index.ts
import express from 'express';
import { checkHealth } from './health.js';

export const app = express();

app.get('/health', async (_req, res) => {
  const health = await checkHealth();
  res.json(health);
});
```

```ts
// src/health.ts
export async function checkHealth(): Promise<HealthStatus> {
  return {
    statu: 'healthy', // <-- RED SQUIGGLE
    cheks: { database: 'ok', redis: 'ok' }, // <-- RED SQUIGGLE
  };
}
```

> Object literal may only specify known properties, and 'statu' does not exist in type 'HealthStatus'. Did you mean 'status'?

The typo is caught before the code even runs. The ops dashboard gets the shape it expects.

## What Changed

- `HealthStatus` interface defines the exact contract with the ops team
- Typos in property names are caught by the compiler
- Refactoring the shape (adding/removing checks) updates all call sites
- CI enforces type safety before deploy

## What We Still Need

TypeScript checks the code we write. But it can't prevent this:

```ts
app.get('/health', async (_req, res) => {
  checkDatabase(); // fire-and-forget, never awaited
  checkRedis();    // fire-and-forget, never awaited
  res.json({ status: 'healthy', checks: { database: 'ok', redis: 'ok' } });
});
```

TypeScript sees this as valid code. But functionally it's a lie — we're not actually checking anything. For that, we need real async handling and runtime validation.
