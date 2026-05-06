# 00-PROBLEM: Bulkhead Pattern

## WHAT is the problem?

The Bulkhead Pattern isolates resources so that a failure in one workload cannot exhaust resources needed by another. The problem is that **using a single shared pool for all workload types** defeats isolation—background jobs can starve critical user requests.

## WHY does this matter?

- **Critical path starvation**: A burst of background jobs can fill the pool, causing user-facing requests to be rejected with 503.
- **Cascading failures**: One slow workload type can block all others.
- **Violated SLAs**: User requests fail while the system is technically "up" because the shared pool is full of non-critical work.

## HOW does the bug manifest?

The current `src/bulkhead.ts` creates **one shared pool** and ignores the `poolName` parameter:

```typescript
const sharedPool = new Pool('shared', 3);

export async function executeWithPool<T>(poolName: string, fn: () => Promise<T>): Promise<T> {
  // BUG: poolName is ignored; everything uses sharedPool
  if (!sharedPool.hasCapacity()) {
    throw new Error('Pool is full');
  }
  sharedPool.acquire();
  try {
    return await fn();
  } finally {
    sharedPool.release();
  }
}
```

## WRONG vs RIGHT

| Aspect | WRONG (Current) | RIGHT (Fixed) |
|--------|-----------------|---------------|
| Pool count | 1 shared pool | N named pools (critical, background, etc.) |
| Isolation | None | Complete isolation per workload type |
| Critical path protection | Vulnerable to background bursts | Protected regardless of background load |
| Rejection granularity | "Pool is full" (which one?) | "Pool 'background' is full" |

## ASCII Diagram: Shared Pool Starvation

```
User Request              Background Jobs              Shared Pool
    |                            |                          |
    |-- GET /critical --------->|                          |
    |                            |-- Job 1 acquire -------->|
    |                            |                          | active: 1/3
    |                            |-- Job 2 acquire -------->|
    |                            |                          | active: 2/3
    |                            |-- Job 3 acquire -------->|
    |                            |                          | active: 3/3 FULL
    |                            |                          |
    |-- GET /critical --------->|                          |
    |                            |                          | REJECTED!
    |<-- 503 "Pool is full" ----|                          |
```

## Real-World Impact

In 2020, a video streaming platform had a bulkhead implementation with a shared thread pool for both video encoding (background) and user authentication (critical). During a peak encoding backlog, all authentication requests were rejected. Users couldn't log in for 45 minutes during a major content release, causing a 15% drop in viewer engagement and trending negative on social media.
