# 04-OLD-VS-NEW: Bulkhead Pattern

## WHAT changed between 2015 and 2025?

Resource isolation evolved from **manual thread pools in application code** to **OS-level cgroup limits, Kubernetes resource quotas, and service mesh sidecars** that enforce bulkheads transparently.

## WHY did it change?

Application-level thread pools were hard to tune and easy to misconfigure. As systems moved to containers and Kubernetes, isolation shifted to the infrastructure layer where it could be enforced uniformly across all services without code changes.

## HOW did it change?

### 2015: Manual Thread Pools (Java / Node.js)

```java
// 2015: Java ExecutorService bulkhead
ExecutorService criticalPool = Executors.newFixedThreadPool(10);
ExecutorService backgroundPool = Executors.newFixedThreadPool(5);

public void handleCritical(Request req) {
    criticalPool.submit(() -> process(req));
}

public void handleBackground(Request req) {
    backgroundPool.submit(() -> process(req));
}
```

**Pros:**
- Explicit control over concurrency.
- Language-native primitives.

**Cons:**
- Per-service implementation; inconsistent across the fleet.
- Easy to forget `try/finally` and leak threads.
- No automatic metrics or alerting.
- Doesn't protect against memory or CPU exhaustion.

### 2025: Kubernetes + Service Mesh Bulkheads

```yaml
# 2025: Kubernetes Resource Quotas
apiVersion: v1
kind: ResourceQuota
metadata:
  name: background-jobs
spec:
  hard:
    requests.cpu: "2"
    requests.memory: 4Gi
    pods: "10"
```

```yaml
# 2025: Istio DestinationRule (connection pool bulkhead)
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: user-service
spec:
  host: user-service
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
        http2MaxRequests: 1000
    outlierDetection:
      consecutiveErrors: 5
      interval: 30s
      baseEjectionTime: 30s
```

**Pros:**
- Enforced at the infrastructure level; no code needed.
- Protects CPU, memory, and connections uniformly.
- Service mesh adds circuit breakers, retries, and mTLS automatically.
- Metrics exported to Prometheus out of the box.

**Cons:**
- Requires Kubernetes and sidecar expertise.
- Sidecars add latency (~1-3ms) and memory overhead.
- Less granular control than in-code pools.

## WRONG vs RIGHT

| Aspect | OLD (2015) | NEW (2025) |
|--------|------------|------------|
| Isolation level | Thread pool in code | cgroup / container / sidecar |
| Enforcement | Developer discipline | Platform-enforced |
| Metrics | Manual instrumentation | Automatic Prometheus export |
| Scope | Single service | Fleet-wide policy |
| Resource types | Threads only | CPU, memory, connections, requests |

## Old Code vs New Code in This Project

### Old (Buggy) Code

```typescript
// src/bulkhead.ts (as-is)
const sharedPool = new Pool('shared', 3);

export async function executeWithPool<T>(poolName: string, fn: () => Promise<T>): Promise<T> {
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

### New (Fixed) Code

```typescript
// src/bulkhead.ts (fixed)
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

**Key Differences:**
- `pools` is a map of `Pool` instances instead of a single `sharedPool`.
- `poolName` is used to look up the correct pool.
- `getPoolStatus()` reports per-pool metrics.
