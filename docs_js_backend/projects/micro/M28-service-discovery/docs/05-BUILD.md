# 05-BUILD: Service Discovery

## WHAT are we building?

A minimal service registry with heartbeat-based health tracking. Services register themselves, send periodic heartbeats, and the registry automatically removes stale entries.

## WHY build it from scratch?

Understanding TTL, cleanup jobs, and the registration contract is essential. When Kubernetes DNS fails, you need to know how to debug a registry. That requires knowing how registries work under the hood.

## HOW to build it step-by-step from an empty folder

### Step 0: Empty Folder

```bash
mkdir service-discovery && cd service-discovery
```

### Step 1: Initialize Project

```bash
npm init -y
npm install express typescript ts-node @types/express @types/node supertest @types/supertest jest @jest/globals ts-jest
```

### Step 2: TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true
  }
}
```

### Step 3: Registry Model

```typescript
// src/registry.ts
import { randomUUID } from 'crypto';

export interface Service {
  id: string;
  name: string;
  url: string;
  registeredAt: number;
  lastHeartbeat: number;
}

const registry: Service[] = [];
const TTL = 3000; // 3 seconds for demo

export function registerService(name: string, url: string): Service {
  const service: Service = {
    id: randomUUID(),
    name,
    url,
    registeredAt: Date.now(),
    lastHeartbeat: Date.now(),
  };
  registry.push(service);
  return service;
}

export function getServices(name: string): Service[] {
  const now = Date.now();
  return registry.filter(s =>
    s.name === name && (now - s.lastHeartbeat) <= TTL
  );
}

export function updateHeartbeat(id: string): boolean {
  const service = registry.find(s => s.id === id);
  if (!service) return false;
  service.lastHeartbeat = Date.now();
  return true;
}

export function getRegistry(): Service[] {
  return registry;
}
```

**WHAT:** Stores services with registration time and last heartbeat.
**WHY:** We need to know when a service was last proven alive.
**HOW:** Array of `Service` objects; `getServices()` filters by TTL.

### Step 4: Heartbeat Cleanup

```typescript
// src/heartbeat.ts
import { getRegistry } from './registry.js';

export function cleanup() {
  const now = Date.now();
  const registry = getRegistry();
  for (let i = registry.length - 1; i >= 0; i--) {
    if (now - registry[i].lastHeartbeat > 3000) {
      console.log(`Removing stale service: ${registry[i].id}`);
      registry.splice(i, 1);
    }
  }
}

export function startCleanup(intervalMs: number = 1500) {
  setInterval(cleanup, intervalMs);
}
```

**WHAT:** Removes services that haven't heartbeated within TTL.
**WHY:** Without cleanup, the registry fills with ghosts.
**HOW:** Iterate backwards (to avoid index shift) and splice stale entries.

### WRONG vs RIGHT in Steps 3-4

| Without Fix | With Fix |
|-------------|----------|
| `getServices()` returns all entries | Filters by `now - lastHeartbeat <= TTL` |
| `startCleanup()` is empty | `setInterval(cleanup, 1500)` actively prunes |
| Registry grows forever | Memory stays bounded |

### Step 5: Main Application

```typescript
// src/index.ts
import express, { Request, Response } from 'express';
import { registerService, getServices, updateHeartbeat } from './registry.js';
import { startCleanup } from './heartbeat.js';

const app = express();
const PORT = process.env.DISCOVERY_PORT || 3000;

app.use(express.json());

app.post('/register', (req: Request, res: Response) => {
  const { name, url } = req.body;
  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }
  const service = registerService(name, url);
  res.status(201).json(service);
});

app.get('/discover/:name', (req: Request, res: Response) => {
  const services = getServices(req.params.name);
  res.json(services);
});

app.post('/heartbeat/:id', (req: Request, res: Response) => {
  const success = updateHeartbeat(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Service not found' });
  }
  res.json({ status: 'ok' });
});

if (process.env.NODE_ENV !== 'test') {
  startCleanup();
  app.listen(PORT, () => {
    console.log(`Service Discovery listening on port ${PORT}`);
  });
}

export { app };
```

### Step 6: Test

```bash
# Start registry
npm run dev

# Register a service
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"name":"user-service","url":"http://localhost:3001"}'
# → {"id":"...","name":"user-service","url":"http://localhost:3001",...}

# Discover
curl http://localhost:3000/discover/user-service
# → [{"id":"...",...}]

# Send heartbeat
curl -X POST http://localhost:3000/heartbeat/ID_FROM_ABOVE

# Wait 4 seconds without heartbeat, discover again
# → [] (empty array, service removed)
```

## ASCII Diagram: Build Flow

```
Empty Folder
    │
    ▼
npm init + install deps
    │
    ▼
 tsconfig.json
    │
    ▼
 src/registry.ts    src/heartbeat.ts   src/index.ts
    │                    │                    │
    └────────────────────┼────────────────────┘
                         ▼
                  npm run dev
                         │
                         ▼
              Register → Heartbeat → Discover
```
