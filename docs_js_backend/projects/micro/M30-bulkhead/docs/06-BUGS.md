# 06-BUGS: Bulkhead Pattern

## WHAT is the bug?

The bulkhead implementation uses a **single shared pool** for all workload types. The `poolName` parameter in `executeWithPool()` is completely ignored. This means:
1. Background jobs and critical requests compete for the same slots.
2. When the shared pool is full, critical user-facing requests are rejected.

## WHY is this a real-world disaster?

The bulkhead pattern exists to **protect the critical path**. A shared pool defeats this purpose. In production, this causes:
- **SLA violations**: User requests fail while the system is "up" because the pool is full of background work.
- **Cascading degradation**: A batch job backlog blocks all other functionality.
- **False alerts**: Monitoring shows 503 errors but CPU/memory are healthy, confusing on-call engineers.

## HOW to reproduce

### Reproduction 1: Background Starves Critical

```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Flood background pool (max 3)
for i in {1..4}; do
  curl -s http://localhost:3000/background &
done
wait
# EXPECTED: 3 succeed, 1 returns 503 (background pool full)
# CRITICAL should still work

# Terminal 3: Send critical request WHILE background is full
curl -s http://localhost:3000/critical
# EXPECTED: 200 OK (critical has its own pool)
# ACTUAL: 503 "Pool is full" (shares the same pool!)
```

### Reproduction 2: No Isolation Metrics

```bash
# Check pool status
curl -s http://localhost:3000/status
# EXPECTED: { "critical": { active: 0, max: 3 }, "background": { active: 3, max: 3 } }
# ACTUAL: Only returns a single shared pool status
```

### Test Code That Exposes the Bug

```typescript
// tests/bulkhead.test.ts
it('should isolate critical from background', async () => {
  const bgPromises = [
    request(app).get('/background'),
    request(app).get('/background'),
    request(app).get('/background'),
  ];

  await new Promise(r => setTimeout(r, 50));

  const critical = await request(app).get('/critical');
  await Promise.all(bgPromises);

  expect(critical.status).toBe(503); // BUG: Should be 200!
});
```

## Real-World Impact

**Case Study: 2020 Video Streaming Authentication Outage**
A video streaming platform implemented a "bulkhead" using a single shared thread pool for both video encoding (background) and user authentication (critical). During a content release, the encoding backlog grew because of high-resolution source files. The shared pool filled with encoding tasks.

**Impact:**
- User authentication requests were rejected with 503.
- Users could not log in for 45 minutes during a major premiere.
- Viewer engagement dropped 15% during the outage window.
- Social media backlash trended negatively.
- The post-mortem revealed the bulkhead was a "shared bulkhead"—an oxymoron.

## The Fix

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

## WRONG vs RIGHT

| Aspect | WRONG (Buggy) | RIGHT (Fixed) |
|--------|---------------|---------------|
| Pool count | 1 shared pool | N named pools |
| Isolation | None | Complete per workload type |
| Critical path protection | Vulnerable to background load | Protected regardless |
| Rejection message | "Pool is full" | "Pool 'background' is full" |
| Observability | Single global status | Per-pool metrics |

## Prevention Checklist

- [ ] Each workload type has its own `Pool` instance.
- [ ] `executeWithPool()` uses `poolName` to select the correct pool.
- [ ] Tests verify that filling pool A does not affect pool B.
- [ ] Metrics are exposed per pool (active, rejected, queue wait).
- [ ] Pool limits are configurable per environment.
- [ ] There is a fallback or degraded mode when a pool is full.
