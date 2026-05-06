# 05-BUILD: Load Balancer

## WHAT are we building?

A round-robin HTTP load balancer with health checks. It distributes traffic across 3 backends and automatically removes failed ones from rotation.

## WHY build it from scratch?

Understanding how health checks and selection algorithms interact is fundamental. If you only use cloud LBs, you'll be helpless when traffic still routes to a "healthy" backend that passes TCP but fails application logic.

## HOW to build it step-by-step from an empty folder

### Step 0: Empty Folder

```bash
mkdir load-balancer && cd load-balancer
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

### Step 3: Backend State & Selection

```typescript
// src/balancer.ts
interface Backend {
  port: number;
  healthy: boolean;
}

const backends: Backend[] = [
  { port: 3001, healthy: true },
  { port: 3002, healthy: true },
  { port: 3003, healthy: true },
];

let counter = 0;

export function selectBackend(): Backend | null {
  const healthy = backends.filter(b => b.healthy);
  if (healthy.length === 0) return null;
  const backend = healthy[counter % healthy.length];
  counter++;
  return backend;
}

export function getBackends(): Backend[] {
  return backends;
}

export function setBackendHealth(port: number, healthy: boolean) {
  const backend = backends.find(b => b.port === port);
  if (backend) backend.healthy = healthy;
}
```

**WHAT:** Maintains a list of backends and selects only healthy ones via round-robin.
**WHY:** Blind round-robin causes intermittent failures when backends die.
**HOW:** Filters by `healthy` before modulo selection.

### Step 4: Health Check Module

```typescript
// src/health.ts
import http from 'http';
import { getBackends, setBackendHealth } from './balancer.js';

export function checkHealth(backendPort: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${backendPort}/health`, { timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

export function startHealthChecks(intervalMs: number = 5000) {
  setInterval(async () => {
    for (const backend of getBackends()) {
      const healthy = await checkHealth(backend.port);
      setBackendHealth(backend.port, healthy);
    }
  }, intervalMs);
}
```

**WHAT:** Probes each backend's `/health` endpoint every 5 seconds.
**WHY:** Automatic detection of failures and recoveries.
**HOW:** `http.get` with a 2-second timeout; marks unhealthy on error or timeout.

### WRONG vs RIGHT in Step 4

| Without Fix | With Fix |
|-------------|----------|
| `startHealthChecks()` is empty | `setInterval` actively probes |
| `selectBackend()` ignores health | Filters `backends.filter(b => b.healthy)` |
| Dead backends get traffic | Dead backends are skipped |

### Step 5: Main Application

```typescript
// src/index.ts
import express, { Request, Response } from 'express';
import { selectBackend } from './balancer.js';
import { startHealthChecks } from './health.js';
import http from 'http';

const app = express();
const PORT = process.env.LB_PORT || 3000;

app.use(express.json());

app.all('*', async (req: Request, res: Response) => {
  const backend = selectBackend();
  if (!backend) {
    return res.status(503).json({ error: 'No backends available' });
  }

  const options = {
    hostname: 'localhost',
    port: backend.port,
    path: req.path,
    method: req.method,
    headers: req.headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode || 200);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.status(502).json({ error: 'Bad Gateway', message: err.message });
  });

  req.pipe(proxyReq);
});

if (process.env.NODE_ENV !== 'test') {
  startHealthChecks();
  app.listen(PORT, () => {
    console.log(`Load Balancer listening on port ${PORT}`);
  });
}

export { app };
```

### Step 6: Test

```bash
# Start 3 backends
node -e "require('http').createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({backend:1}));}).listen(3001)"
node -e "require('http').createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({backend:2}));}).listen(3002)"
node -e "require('http').createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({backend:3}));}).listen(3003)"

# Start balancer
npm run dev

# Test round-robin
for i in {1..6}; do curl -s http://localhost:3000/; done
# → {"backend":1}{"backend":2}{"backend":3}{"backend":1}{"backend":2}{"backend":3}

# Kill backend 2, wait 5s, test again
# → only 1 and 3 respond
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
 src/balancer.ts    src/health.ts      src/index.ts
    │                    │                    │
    └────────────────────┼────────────────────┘
                         ▼
                  npm run dev
                         │
                         ▼
              Start 3 backends + test
```
