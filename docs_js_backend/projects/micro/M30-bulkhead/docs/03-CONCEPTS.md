# 03-CONCEPTS: Bulkhead Pattern

## WHAT is the Bulkhead Pattern?

The Bulkhead Pattern isolates failures by partitioning resources into separate pools. If one pool is exhausted or fails, the others continue to function. It is named after the watertight compartments (bulkheads) in ships.

## WHY do we need it?

| Without Bulkhead | With Bulkhead |
|------------------|---------------|
| One slow workload blocks all others | Each workload has its own resource limit |
| Background jobs starve user requests | Critical path is protected |
| Total system failure on overload | Partial degradation, core functions survive |
| No prioritization | Explicit resource allocation by priority |

## HOW does it work?

### Compartment Model

```
┌─────────────────────────────────────────────┐
│                 System                       │
│                                              │
│  ┌─────────────┐      ┌─────────────┐       │
│  │ Pool A      │      │ Pool B      │       │
│  │ Critical    │      │ Background  │       │
│  │ max: 10     │      │ max: 5      │       │
│  │ active: 9   │      │ active: 5   │       │
│  │             │      │ FULL        │       │
│  └──────┬──────┘      └─────────────┘       │
│         │                                    │
│         ▼                                    │
│    Request accepted                          │
│                                              │
│  Background request ──▶ Pool B ──▶ REJECTED  │
│                                              │
└─────────────────────────────────────────────┘
```

1. **Define pools**: Create a pool per workload type (critical, background, analytics).
2. **Set limits**: Each pool has a maximum concurrency.
3. **Acquire**: Before executing, acquire a slot from the target pool.
4. **Execute**: Run the work.
5. **Release**: Always release the slot in a `finally` block.
6. **Reject**: If the pool is full, return 503 immediately.

## WRONG vs RIGHT

### Wrong: Shared Pool

```typescript
const sharedPool = new Pool('shared', 3);

async function executeWithPool(poolName: string, fn: () => Promise<T>) {
  // BUG: poolName ignored; everything uses sharedPool
  if (!sharedPool.hasCapacity()) throw new Error('Pool is full');
  sharedPool.acquire();
  try { return await fn(); } finally { sharedPool.release(); }
}
```

**Why Wrong:**
- **No isolation**: Background jobs consume slots needed for critical requests.
- **False bulkhead**: The system appears to have a bulkhead, but it's a single point of failure.
- **Violated priority**: Low-priority work can block high-priority work.

### Right: Named Pools

```typescript
const pools: Record<string, Pool> = {
  critical: new Pool('critical', 10),
  background: new Pool('background', 5),
};

async function executeWithPool(poolName: string, fn: () => Promise<T>) {
  const pool = pools[poolName];
  if (!pool) throw new Error('Unknown pool');
  if (!pool.hasCapacity()) throw new Error(`Pool ${poolName} is full`);
  pool.acquire();
  try { return await fn(); } finally { pool.release(); }
}
```

**Why Right:**
- **True isolation**: Critical requests have their own dedicated slots.
- **Predictable behavior**: Background saturation never affects critical path.
- **Scalable**: Add new workload types by adding new pool definitions.

## Key Concepts

| Concept | Definition |
|---------|------------|
| Bulkhead | A partition that isolates resources to prevent failure propagation. |
| Pool | A limited set of resources dedicated to a specific workload. |
| Capacity | The maximum number of concurrent operations a pool allows. |
| Rejection | Returning an error immediately when a pool is at capacity. |
| Backpressure | Signaling upstream that the system is overloaded. |

## ASCII Diagram: Bulkhead Protection

```
Before Bulkhead (Shared Pool):
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│Critical1│  │Critical2│  │Background│  │Background│
└────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘
     └─────────────┴────────────┴────────────┘
                    │
             ┌─────────────┐
             │ Shared Pool │  max: 3
             │   FULL      │
             └─────────────┘
                    │
             All 4 requests compete;
             at least 1 critical request fails

After Bulkhead (Separate Pools):
┌─────────┐  ┌─────────┐         ┌─────────┐  ┌─────────┐
│Critical1│  │Critical2│         │Background│  │Background│
└────┬────┘  └────┬────┘         └────┬────┘  └────┬────┘
     │            │                   │            │
     ▼            ▼                   ▼            ▼
┌─────────┐  ┌─────────┐         ┌─────────┐  ┌─────────┐
│Pool A   │  │Pool A   │         │Pool B   │  │Pool B   │
│max: 3   │  │max: 3   │         │max: 3   │  │max: 3   │
│accepted │  │accepted │         │accepted │  │accepted │
└─────────┘  └─────────┘         └─────────┘  └─────────┘

Critical requests succeed regardless of background load
```
