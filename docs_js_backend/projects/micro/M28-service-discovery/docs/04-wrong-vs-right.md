# WRONG vs RIGHT: Service Discovery

## The Bug: No Heartbeat Cleanup

### Wrong (Current Code)

```typescript
// src/heartbeat.ts
// Nothing here! No cleanup runs.

// src/registry.ts
function getServices(name: string) {
  return registry.filter(s => s.name === name);
  // Returns dead services too!
}
```

**Why It's Wrong:**
- Services that crash never get removed.
- The registry grows indefinitely with stale entries.
- Clients discover URLs that return connection refused.
- Memory usage grows without bound.

### Right (Fixed Code)

```typescript
// src/heartbeat.ts
const HEARTBEAT_INTERVAL = 10000;
const CLEANUP_INTERVAL = 15000;
const TTL = 30000;

function cleanup() {
  const now = Date.now();
  for (let i = registry.length - 1; i >= 0; i--) {
    if (now - registry[i].lastHeartbeat > TTL) {
      console.log(`Removing stale service: ${registry[i].id}`);
      registry.splice(i, 1);
    }
  }
}

setInterval(cleanup, CLEANUP_INTERVAL);

// src/registry.ts
function getServices(name: string) {
  const now = Date.now();
  return registry.filter(s => s.name === name && (now - s.lastHeartbeat) <= TTL);
}
```

**Why It's Right:**
- A cleanup job runs every 15 seconds.
- Services missing heartbeats for 30 seconds are removed.
- Discovery queries only return currently healthy instances.
- Memory stays bounded.

## Key Takeaway

Service discovery is only useful if the registry reflects reality. Without heartbeat cleanup, it becomes a source of misdirection and failed requests.
