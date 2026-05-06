# 06-BUGS: Load Balancer

## WHAT is the bug?

The load balancer has **two related bugs**:
1. `selectBackend()` does not filter by health status; it routes to dead backends.
2. `startHealthChecks()` in `src/health.ts` is commented out, so health status never updates.

## WHY is this a real-world disaster?

A load balancer that routes to dead backends is worse than no load balancer at all. It gives the illusion of high availability while serving intermittent errors. Users see flaky behavior, and operations teams chase ghosts because "the balancer says everything is fine."

## HOW to reproduce

### Reproduction 1: Dead Backend Still Gets Traffic

```bash
# Terminal 1: Start backends 1 and 3, but NOT 2
node -e "require('http').createServer((req,res)=>{res.end('1');}).listen(3001)"
# Skip 3002
node -e "require('http').createServer((req,res)=>{res.end('3');}).listen(3003)"

# Terminal 2: Start balancer
npm run dev

# Terminal 3: Send 6 requests
for i in {1..6}; do curl -s http://localhost:3000/ || echo "FAIL"; done
# EXPECTED: Only backends 1 and 3 respond
# ACTUAL: Every 2nd or 3rd request fails with 502 because backend 2 is selected
```

### Reproduction 2: Health Checks Never Start

```bash
# Start all 3 backends
node -e "require('http').createServer((req,res)=>{res.end('1');}).listen(3001)"
node -e "require('http').createServer((req,res)=>{res.end('2');}).listen(3002)"
node -e "require('http').createServer((req,res)=>{res.end('3');}).listen(3003)"

# Start balancer, then kill backend 2
kill $BACKEND2_PID

# Wait 10 seconds (longer than health check interval)
# Send requests
for i in {1..6}; do curl -s http://localhost:3000/ || echo "FAIL"; done
# EXPECTED: After 5s, backend 2 is marked unhealthy and skipped
# ACTUAL: Backend 2 is still selected because health checks never started
```

### Test Code That Exposes the Bug

```typescript
// tests/balancer.test.ts
it('should skip unhealthy backends', async () => {
  backend2.close();
  await new Promise(r => setTimeout(r, 100));

  const responses = [];
  for (let i = 0; i < 6; i++) {
    const res = await request(app).get('/').catch(() => ({ status: 502 }));
    responses.push(res.status);
  }

  const failures = responses.filter(s => s === 502).length;
  expect(failures).toBeGreaterThan(0); // BUG: backend2 still routed
});
```

## Real-World Impact

**Case Study: 2016 E-Commerce Black Friday**
A major retailer's load balancer had health checks configured but disabled (similar to the commented-out code here). During peak traffic, 30% of their cart service backends crashed under load. The balancer continued routing checkout requests to the dead backends. Customers saw "Error 502" at checkout. The company later estimated 12% of checkout attempts failed, costing approximately $4M in lost sales during the 4-hour incident.

**Root Cause:** Health checks existed in the config file but were not attached to the backend pool due to a copy-paste error during a previous deploy.

## The Fix

```typescript
// src/balancer.ts
export function selectBackend(): Backend | null {
  const healthy = backends.filter(b => b.healthy);
  if (healthy.length === 0) return null;
  const backend = healthy[counter % healthy.length];
  counter++;
  return backend;
}

// src/health.ts
export function startHealthChecks(intervalMs: number = 5000) {
  setInterval(async () => {
    for (const backend of getBackends()) {
      const healthy = await checkHealth(backend.port);
      setBackendHealth(backend.port, healthy);
    }
  }, intervalMs);
}

// src/index.ts
startHealthChecks();
```

## WRONG vs RIGHT

| Aspect | WRONG (Buggy) | RIGHT (Fixed) |
|--------|---------------|---------------|
| Health filtering | None | `backends.filter(b => b.healthy)` |
| Health check startup | Never starts | `setInterval` every 5s |
| Dead backend behavior | Still routed | Skipped automatically |
| Recovery behavior | Manual restart required | Auto-recovery on `/health` 200 |
| All-down response | 502 from dead backend | 503 from balancer |

## Prevention Checklist

- [ ] `selectBackend()` filters by health status before selection.
- [ ] Health checks start automatically on server boot.
- [ ] Health checks run on an interval, not just once.
- [ ] Tests verify that stopping a backend removes it from rotation.
- [ ] Tests verify that restarting a backend re-adds it.
- [ ] Balancer returns 503 (not 502) when all backends are down.
