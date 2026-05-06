# WRONG vs RIGHT: Load Balancer

## The Bug: No Health Checks

### Wrong (Current Code)

```typescript
// src/balancer.ts
let counter = 0;

function selectBackend() {
  const backend = backends[counter % backends.length];
  counter++;
  return backend; // May return a dead server!
}
```

**Why It's Wrong:**
- Backends that have crashed or are unresponsive are still selected.
- Clients receive 502/504 errors on every nth request.
- There is no automatic recovery when a backend comes back online.

### Right (Fixed Code)

```typescript
// src/balancer.ts
let counter = 0;

function selectBackend() {
  const healthyBackends = backends.filter(b => b.healthy);
  if (healthyBackends.length === 0) {
    return null;
  }
  const backend = healthyBackends[counter % healthyBackends.length];
  counter++;
  return backend;
}

// src/health.ts
function checkHealth() {
  for (const backend of backends) {
    http.get(backend.url + '/health', { timeout: 2000 }, (res) => {
      backend.healthy = res.statusCode === 200;
    }).on('error', () => {
      backend.healthy = false;
    });
  }
}

setInterval(checkHealth, 5000);
```

**Why It's Right:**
- Only healthy backends participate in round-robin selection.
- Unhealthy backends are probed every 5 seconds.
- When a backend recovers, it is automatically re-added.
- If all backends are down, the balancer returns 503.

## Key Takeaway

A load balancer without health checks is just a traffic distributor to random servers, including dead ones. Health checks are essential for reliability.
