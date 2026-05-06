# v7: Production Setup — Load Balancer

## The Journey

We started with a single hardcoded server, added types, validation, logging, tests, and ESM. Now we have a load balancer that routes around failures.

## What v7 Adds

- **Health-aware routing**: Only `healthy === true` backends get traffic
- **Weighted round-robin**: Backend A gets 3x traffic of Backend B
- **Least-connections**: Route to the backend with fewest active requests
- **Passive health checks**: 502s mark backend unhealthy immediately
- **Automatic recovery**: Health probe success restores traffic

## The Final Code

```typescript
// src/balancer.ts
import { logger } from './logger.js';

export interface Backend {
  port: number;
  healthy: boolean;
  weight: number;
  activeConnections: number;
}

const backends: Backend[] = [
  { port: 3001, healthy: true, weight: 3, activeConnections: 0 },
  { port: 3002, healthy: true, weight: 2, activeConnections: 0 },
  { port: 3003, healthy: true, weight: 1, activeConnections: 0 },
];

let counter = 0;

export function selectBackend(strategy: 'round-robin' | 'weighted' | 'least-connections' = 'round-robin'): Backend | null {
  const healthy = backends.filter(b => b.healthy);
  if (healthy.length === 0) {
    logger.error('All backends unhealthy');
    return null;
  }

  if (strategy === 'least-connections') {
    return healthy.reduce((min, b) => b.activeConnections < min.activeConnections ? b : min);
  }

  if (strategy === 'weighted') {
    const totalWeight = healthy.reduce((sum, b) => sum + b.weight, 0);
    let pick = counter % totalWeight;
    counter++;
    for (const b of healthy) {
      pick -= b.weight;
      if (pick < 0) return b;
    }
    return healthy[0];
  }

  const backend = healthy[counter % healthy.length];
  counter++;
  return backend;
}

export function recordConnectionStart(port: number): void {
  const b = backends.find(b => b.port === port);
  if (b) b.activeConnections++;
}

export function recordConnectionEnd(port: number): void {
  const b = backends.find(b => b.port === port);
  if (b) b.activeConnections = Math.max(0, b.activeConnections - 1);
}

export function setBackendHealth(port: number, healthy: boolean): void {
  const backend = backends.find(b => b.port === port);
  if (backend && backend.healthy !== healthy) {
    backend.healthy = healthy;
    logger.info({ port, healthy }, 'Backend health changed');
  }
}

export function getBackends(): Backend[] {
  return backends;
}
```

## Why This Matters in Production

Without health checks, 1/3 of requests hit a dead backend during a deploy. Without weights, a 16-core server gets the same traffic as a 2-core server. Without least-connections, a long-polling request blocks a backend while others sit idle.

## Pain → Solution Summary

| Version | Pain | Solution |
|---------|------|----------|
| v1 | Single server = single point of failure | Backend array |
| v2 | Untyped backend objects | `Backend` interface |
| v3 | Invalid port numbers (99999) accepted | Validate `port` range |
| v4 | No visibility into routing decisions | Log every selection + health change |
| v5 | Dead backends silently selected | Jest tests mock health transitions |
| v6 | CJS module caching issues | ESM with fresh imports |
| v7 | Uneven load, no failure recovery | Weighted + least-connections + health checks |

## Run It

```bash
LB_PORT=3000 BACKENDS=3001:3,3002:2,3003:1 node dist/index.js
```
