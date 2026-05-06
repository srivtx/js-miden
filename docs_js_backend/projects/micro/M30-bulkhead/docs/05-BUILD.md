# 05-BUILD: Bulkhead Pattern

## WHAT are we building?

A bulkhead pattern implementation with separate resource pools for critical and background workloads. Each pool has its own capacity limit, and exhaustion of one pool does not affect the other.

## WHY build it from scratch?

Understanding `acquire`/`release` semantics and the danger of shared state is essential. Many "bulkhead" libraries are misconfigured because developers don't realize they accidentally share a semaphore across all workload types.

## HOW to build it step-by-step from an empty folder

### Step 0: Empty Folder

```bash
mkdir bulkhead && cd bulkhead
```

### Step 1: Initialize Project

```bash
npm init -y
npm install express typescript ts-node @types/express @types/node supertest @types/supertest jest @jest/globals ts-jest
```

### Step 2: TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true
  }
}
```

### Step 3: Pool Implementation

```typescript
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

**WHAT:** A semaphore that tracks active operations against a max limit.
**WHY:** We need a lightweight counter to enforce concurrency limits.
**HOW:** `acquire()` increments; `release()` decrements; `hasCapacity()` checks the ceiling.

### Step 4: Bulkhead with Named Pools

```typescript
// src/bulkhead.ts
import { Pool } from './pool.js';

const pools: Record<string, Pool> = {
  critical: new Pool('critical', 10),
  background: new Pool('background', 5),
};

export async function executeWithPool<T>(poolName: string, fn: () => Promise<T>): Promise<T> {
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

**WHAT:** Routes each request to a named pool, acquires a slot, executes, and releases.
**WHY:** Shared pools defeat the purpose of isolation.
**HOW:** Map of `Pool` instances keyed by workload type.

### WRONG vs RIGHT in Steps 3-4

| Without Fix | With Fix |
|-------------|----------|
| `const sharedPool = new Pool('shared', 3)` | `const pools = { critical: new Pool(...), background: new Pool(...) }` |
| `poolName` parameter ignored | `poolName` selects the correct pool |
| Critical requests blocked by background | Critical pool is independent |

### Step 5: Main Application

```typescript
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

### Step 6: Test

```bash
# Start server
npm run dev

# Send critical requests (should always succeed)
curl http://localhost:3000/critical
# → {"type":"critical","status":"ok"}

# Flood background pool (5 concurrent)
for i in {1..6}; do curl -s http://localhost:3000/background & done; wait
# → 5 succeed, 1 returns 503

# Critical still works even though background is full
curl http://localhost:3000/critical
# → {"type":"critical","status":"ok"}
```

## ASCII Diagram: Build Flow

```
Empty Folder
    │
    ▼
npm init + install deps
    │
    ▼
 tsconfig.json
    │
    ▼
 src/pool.ts        src/bulkhead.ts    src/index.ts
    │                    │                    │
    └────────────────────┼────────────────────┘
                         ▼
                  npm run dev
                         │
                         ▼
              Test critical + background isolation
```
