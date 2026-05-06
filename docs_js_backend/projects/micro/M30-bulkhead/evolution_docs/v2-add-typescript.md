# M30 Bulkhead — v2 Add TypeScript

## The Bug: Types Catch YOUR Bugs

You refactor v1 to support named pools:

```js
const pools = {
  critical: new Pool('critical', 10),
  background: new Pool('background', 5),
};

async function executeWithPool(poolName, fn) {
  const pool = pools[poolName];
  if (!pool.hasCapcity()) {  // typo: hasCapcity
    throw new Error('Pool is full');
  }
  pool.acquire();
  // ...
}
```

**The bug:** `hasCapcity` is a typo. JavaScript silently returns `undefined`, which is falsy. The pool never rejects. You think you have a bulkhead, but requests pass through unchecked.

Another bug: you change the return type of `executeWithPool`:

```js
// BEFORE: returns the promise result
const result = await executeWithPool('critical', async () => ({ status: 'ok' }));

// AFTER: you accidentally return the pool object
async function executeWithPool(poolName, fn) {
  const pool = pools[poolName];
  pool.acquire();
  try { return await fn(); } finally { pool.release(); }
  return pool; // unreachable, but TypeScript would flag the double return
}
```

## The Fix: Add TypeScript

```ts
// pool.ts
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
    if (this.active > 0) this.active--;
  }
}
```

```ts
// bulkhead.ts
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
  if (!pool) throw new Error(`Unknown pool: ${poolName}`);
  if (!pool.hasCapacity()) throw new Error(`Pool ${poolName} is full`);

  pool.acquire();
  try {
    return await fn();
  } finally {
    pool.release();
  }
}
```

Now `tsc` errors on:
```
bulkhead.ts:5:15 - error TS2339: Property 'hasCapcity' does not exist on type 'Pool'.
```

## But TypeScript Doesn't Catch Everything

TypeScript validates **compile-time** shapes, not **runtime** behavior. A caller can still send:
```ts
executeWithPool('unknown-pool', async () => { ... });
```
TypeScript accepts the string, but at runtime the pool doesn't exist. We need runtime validation.

> **Lesson:** TypeScript eliminates typos and wrong shapes. But runtime validation is required because strings are strings at runtime.

## What v3 Fixes

Validation. Reject unknown pools and invalid parameters before they reach the bulkhead.
