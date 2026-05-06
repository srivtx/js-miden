# v4: Add Logging — Service Discovery

## The Pain

A client reports: "I got `ECONNREFUSED` when trying to reach `user-service`." You check the registry. It lists 3 instances. You don't know which one the client tried. You don't know if any of them are dead. You don't know when they last heartbeated.

You check the registry file (or memory dump). It's just an array of URLs. No timestamps. No health status. No audit trail.

## The Solution

Add structured logging for every registration, heartbeat, discovery, and cleanup event.

## Before (No Logs)

```typescript
// src/registry.ts
export function registerService(name: string, url: string): Service {
  const service: Service = { id: randomUUID(), name, url, registeredAt: Date.now(), lastHeartbeat: Date.now() };
  registry.push(service);
  return service;
}

export function getServices(name: string): Service[] {
  return registry.filter(s => s.name === name);
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
// src/registry.ts
import { logger } from './logger.js';

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
  const alive = registry.filter(s => s.name === name && (now - s.lastHeartbeat) <= TTL);
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
  logger.debug({ id }, 'Heartbeat received');
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
```

## What the Logs Look Like

```json
{"level":30,"time":1715200000000,"id":"a1b2c3","name":"user-service","url":"http://localhost:3001","msg":"Service registered"}
{"level":20,"time":1715200001000,"id":"a1b2c3","msg":"Heartbeat received"}
{"level":20,"time":1715200002000,"name":"user-service","count":1,"msg":"Services discovered"}
{"level":30,"time":1715200004000,"id":"a1b2c3","msg":"Removing stale service"}
{"level":30,"time":1715200004001,"removed":1,"msg":"Cleanup completed"}
```

## Why Logging Matters

- **Ghost detection**: "Removing stale service" tells you cleanup is working
- **Heartbeat monitoring**: Missing heartbeats between logs indicate network issues
- **Discovery audit**: You can trace which services a client received
- **Unknown ID alerts**: "Heartbeat for unknown service" reveals split-brain scenarios

Without logs, the registry is a silent graveyard. With logs, every registration, heartbeat, and death is observable.
