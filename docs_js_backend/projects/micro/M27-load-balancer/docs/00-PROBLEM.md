# 00-PROBLEM: Load Balancer

## WHAT is the problem?

A Load Balancer distributes traffic across multiple backend servers. The problem is that **without health-aware routing**, the balancer sends traffic to dead backends, causing intermittent failures for clients.

## WHY does this matter?

- **User-visible errors**: Every request routed to a dead backend returns 502/504 or hangs.
- **Wasted retries**: Clients may retry, amplifying load on healthy backends.
- **False confidence**: The balancer appears to work (it distributes traffic), but it distributes to *all* servers, including failed ones.

## HOW does the bug manifest?

The current `src/balancer.ts` selects backends via round-robin **without filtering by health status**:

```typescript
export function selectBackend(): Backend | null {
  if (backends.length === 0) return null;
  const backend = backends[counter % backends.length];
  counter++;
  return backend; // May return backend.healthy === false
}
```

Additionally, `src/health.ts` has a `startHealthChecks()` function that is **commented out**, so health status never updates.

## WRONG vs RIGHT

| Aspect | WRONG (Current) | RIGHT (Fixed) |
|--------|-----------------|---------------|
| Health filtering | None; all backends selected | Only `healthy === true` backends selected |
| Health checks | Never started | `setInterval` probes every 5s |
| Recovery | Manual restart required | Automatic when `/health` returns 200 |
| All-down response | 502 from dead backend | 503 Service Unavailable from balancer |

## ASCII Diagram: Traffic to a Dead Backend

```
Client                    Load Balancer              Backends
  |                            |                      |
  |--- GET /api -------------->|                      |
  |                            |--- GET /api ------->|
  |                            |                      | Backend 2 is DOWN
  |                            |                      | (ECONNREFUSED)
  |                            |                      |
  | <---------------- 502 -----|                      |
  |                            |                      |
  |--- GET /api -------------->|                      |
  |                            |--- GET /api ------->|
  |                            |                      | Backend 2 still DOWN
  |                            |                      |
  | <---------------- 502 -----|                      |
```

## Real-World Impact

In 2016, a major e-commerce platform's load balancer had a health-check misconfiguration. During Black Friday, 30% of backends failed, but the balancer kept routing to them. The site served 502 errors to 12% of checkout requests, costing an estimated $4M in lost sales.
