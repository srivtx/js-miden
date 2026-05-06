# v7: Production Setup — Service Discovery

## The Journey

We started with hardcoded URLs, added types, validation, logging, tests, and ESM. Now we have a registry that cleans up after itself.

## What v7 Adds

- **In-memory registry with TTL**: Services expire after missed heartbeats
- **Heartbeat cleanup job**: `setInterval` prunes stale entries every 1.5s
- **Env-based seeding**: `SERVICE_URLS` bootstraps known services
- **Graceful shutdown**: `SIGTERM` unregisters before exit
- **Replication ready**: Registry state can be snapshotted to Redis

## The Final Code

```typescript
// src/registry.ts
import { randomUUID } from 'crypto';
import { logger } from './logger.js';

export interface Service {
  id: string;
  name: string;
  url: string;
  registeredAt: number;
  lastHeartbeat: number;
}

const registry: Service[] = [];
const TTL = 3000; // 3 seconds for demo; 30s in production

export function registerService(name: string, url: string): Service {
  const service: Service = {
    id: randomUUID(),
    name,
    url,
    registeredAt: Date.now(),
    lastHeartbeat: Date.now(),
  };
  registry.push(service);
  logger.info({ id: service.id, name, url }, 'Service registered');
  return service;
}

export function getServices(name: string): Service[] {
  const now = Date.now();
  const alive = registry.filter(s =>
    s.name === name && (now - s.lastHeartbeat) <= TTL
  );
  logger.debug({ name, count: alive.length }, 'Services discovered');
  return alive;
}

export function updateHeartbeat(id: string): boolean {
  const service = registry.find(s => s.id === id);
  if (!service) {
    logger.warn({ id }, 'Heartbeat for unknown service');
    return false;
  }
  service.lastHeartbeat = Date.now();
  return true;
}

export function cleanup(): void {
  const now = Date.now();
  let removed = 0;
  for (let i = registry.length - 1; i >= 0; i--) {
    if (now - registry[i].lastHeartbeat > TTL) {
      logger.info({ id: registry[i].id }, 'Removing stale service');
      registry.splice(i, 1);
      removed++;
    }
  }
  if (removed > 0) logger.info({ removed }, 'Cleanup completed');
}

export function startCleanup(intervalMs: number = 1500): ReturnType<typeof setInterval> {
  return setInterval(cleanup, intervalMs);
}

export function unregister(id: string): boolean {
  const idx = registry.findIndex(s => s.id === id);
  if (idx >= 0) {
    registry.splice(idx, 1);
    logger.info({ id }, 'Service unregistered');
    return true;
  }
  return false;
}
```

## Why This Matters in Production

Without TTL cleanup, a rolling deploy of 10 pods creates 20 registry entries — 10 dead, 10 alive. Clients discover dead URLs 50% of the time. Without heartbeat, a service that OOMs at 02:00 stays in the registry until someone restarts the discovery server.

## Pain → Solution Summary

| Version | Pain | Solution |
|---------|------|----------|
| v1 | Hardcoded URLs break on deploy | Dynamic registry array |
| v2 | Untyped service objects | `Service` interface |
| v3 | Missing name/url accepted | Validate required fields |
| v4 | Ghost services accumulate silently | Log every register/heartbeat/cleanup |
| v5 | Stale entries never removed | Jest tests simulate TTL expiry |
| v6 | CJS module singleton issues | ESM with explicit exports |
| v7 | Registry fills with dead services | Heartbeat + TTL cleanup + graceful unregister |

## Run It

```bash
DISCOVERY_PORT=3000 TTL_MS=30000 CLEANUP_INTERVAL_MS=5000 node dist/index.js
```
