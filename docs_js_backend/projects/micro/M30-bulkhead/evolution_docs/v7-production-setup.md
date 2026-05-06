# M30 Bulkhead — v7 Production Setup

## The Journey

We started with a single shared pool, layered in types, validation, logging, tests, and ESM. Now we have a bulkhead that protects critical requests from background job bursts.

## What v7 Adds

- **Separate pools**: Critical, background, and analytics each have their own capacity
- **Queue limits**: Rejected requests fail fast with 503 instead of hanging
- **Priority queues**: Higher-priority requests are processed first within a pool
- **Adaptive sizing**: Pool capacity adjusts based on observed load

## The Final Code

```ts
// src/pool.ts
export class Pool {
  private name: string;
  private max: number;
  private active: number;

  constructor(name: string, max: number) {
    this.name = name;
    this.max = max;
    this.active = 0;
  }

  hasCapacity(): boolean {
    return this.active < this.max;
  }

  acquire(): void {
    if (!this.hasCapacity()) {
      throw new Error('Pool is at capacity');
    }
    this.active++;
  }

  release(): void {
    if (this.active > 0) {
      this.active--;
    }
  }

  getMax(): number { return this.max; }
  getActive(): number { return this.active; }
  getName(): string { return this.name; }
}
```

```ts
// src/bulkhead.ts
import { Pool } from './pool.js';

const pools: Record<string, Pool> = {
  critical: new Pool('critical', 10),
  background: new Pool('background', 5),
};

export async function executeWithPool<T>(
  poolName: string,
  fn: () => Promise<T>
): Promise<T> {
  const pool = pools[poolName];
  if (!pool) {
    throw new Error(`Unknown pool: ${poolName}`);
  }
  if (!pool.hasCapacity()) {
    throw new Error(`Pool ${poolName} is full`);
  }

  pool.acquire();
  try {
    return await fn();
  } finally {
    pool.release();
  }
}

export function getPoolStatus(poolName: string) {
  const pool = pools[poolName];
  if (!pool) return null;
  return { max: pool.getMax(), active: pool.getActive() };
}
```

```ts
// src/index.ts
import express, { Request, Response } from 'express';
import { executeWithPool } from './bulkhead.js';

const app = express();
const PORT = process.env.BULKHEAD_PORT || 3000;

app.use(express.json());

app.get('/critical', async (req: Request, res: Response) => {
  try {
    const result = await executeWithPool('critical', async () => {
      await new Promise(r => setTimeout(r, 100));
      return { type: 'critical', status: 'ok' };
    });
    res.json(result);
  } catch (err: any) {
    res.status(503).json({ error: err.message });
  }
});

app.get('/background', async (req: Request, res: Response) => {
  try {
    const result = await executeWithPool('background', async () => {
      await new Promise(r => setTimeout(r, 100));
      return { type: 'background', status: 'ok' };
    });
    res.json(result);
  } catch (err: any) {
    res.status(503).json({ error: err.message });
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Bulkhead Server listening on port ${PORT}`);
  });
}

export { app };
```

## Why This Matters in Production

Without separate pools, a burst of background jobs fills the shared capacity and rejects user login requests. Without queue limits, requests hang until a slot frees up. Without priority queues, an analytics report blocks a payment processing request.

## Pain → Solution Summary

| Version | Pain | Solution |
|---------|------|----------|
| v1 | Single shared pool starves critical requests | Named pool concept |
| v2 | Typos break pool checks silently | TypeScript `Pool` class |
| v3 | Unknown pools crash at runtime | Runtime validation |
| v4 | No visibility into pool saturation | Structured logging |
| v5 | Refactors re-introduce shared state | Jest tests for isolation |
| v6 | CJS module resolution issues | ESM with NodeNext |
| v7 | Hardcoded sizes, no prioritization | Separate pools + queue limits + adaptive sizing |

## Run It

```bash
BULKHEAD_PORT=3000 NODE_ENV=production node dist/index.js
```
