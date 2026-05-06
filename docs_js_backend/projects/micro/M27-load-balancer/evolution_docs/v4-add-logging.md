# v4: Add Logging — Load Balancer

## The Pain

Your API returns 502 errors for 10% of requests. You check the backends — two are healthy, one is down. But you don't know which backend was selected for the failing requests. You don't know if the load balancer is still routing to the dead one. You don't know if the health checks are even running.

You restart the load balancer. The 502s stop. You don't know why. You hope it doesn't happen again.

## The Solution

Add structured logging for every routing decision and health state change.

## Before (No Logs)

```typescript
// src/balancer.ts
export function selectBackend(): Backend | null {
  if (backends.length === 0) return null;
  const backend = backends[counter % backends.length];
  counter++;
  return backend;
}
```

## After (With Logging)

```typescript
// src/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
```

```typescript
// src/balancer.ts
import { logger } from './logger.js';

export function selectBackend(): Backend | null {
  const healthy = backends.filter(b => b.healthy);
  if (healthy.length === 0) {
    logger.error('All backends unhealthy');
    return null;
  }
  const backend = healthy[counter % healthy.length];
  counter++;
  logger.debug({ port: backend.port, healthy: backend.healthy }, 'Backend selected');
  return backend;
}

export function setBackendHealth(port: number, healthy: boolean): void {
  const backend = backends.find(b => b.port === port);
  if (backend && backend.healthy !== healthy) {
    backend.healthy = healthy;
    logger.info({ port, healthy }, 'Backend health changed');
  }
}
```

```typescript
// src/index.ts
import { logger } from './logger.js';

app.all('*', async (req, res) => {
  const backend = selectBackend();
  if (!backend) {
    logger.warn({ path: req.path }, 'No backends available');
    return res.status(503).json({ error: 'No backends available' });
  }
  // ... proxy ...
});
```

## What the Logs Look Like

```json
{"level":30,"time":1715200000000,"port":3001,"healthy":false,"msg":"Backend health changed"}
{"level":40,"time":1715200000001,"path":"/api/users","msg":"No backends available"}
{"level":50,"time":1715200000002,"msg":"All backends unhealthy"}
{"level":30,"time":1715200005000,"port":3001,"healthy":true,"msg":"Backend health changed"}
{"level":20,"time":1715200005001,"port":3001,"healthy":true,"msg":"Backend selected"}
```

## Why Logging Matters

- **Failure correlation**: You see port 3001 go unhealthy, then 502s spike
- **Health check visibility**: Logs confirm probes are running and detecting state
- **Routing transparency**: Every selection is logged with port and health
- **Alerting**: "All backends unhealthy" can trigger an auto-scale event

Without logs, a 502 is a guessing game. With logs, you see the exact backend failure sequence.
