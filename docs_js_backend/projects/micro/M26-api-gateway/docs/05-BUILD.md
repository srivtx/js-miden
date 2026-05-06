# 05-BUILD: API Gateway

## WHAT are we building?

A minimal but resilient API Gateway in Node.js + Express that proxies requests to backend services with request IDs, logging, timeouts, and error handling.

## WHY build it from scratch?

Understanding the raw mechanics of HTTP proxying, timeouts, and error handling is essential before using high-level tools like Envoy or Nginx. If you don't know why a gateway needs a timeout, you'll misconfigure Envoy too.

## HOW to build it step-by-step from an empty folder

### Step 0: Empty Folder

```bash
mkdir api-gateway && cd api-gateway
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

### Step 3: Logger Middleware

```typescript
// src/logger.ts
import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] || 'unknown';
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} | RequestID: ${requestId}`);
  next();
}
```

**WHAT:** Logs every request with timestamp, method, path, and request ID.
**WHY:** Observability is mandatory for debugging distributed systems.
**HOW:** Express middleware runs before the route handler.

### Step 4: Proxy Middleware (The Core)

```typescript
// src/gateway.ts
import { Request, Response, NextFunction } from 'express';
import http from 'http';
import { randomUUID } from 'crypto';

export function createProxyMiddleware(targetUrl: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-ID', requestId);
    req.headers['x-request-id'] = requestId;

    const url = new URL(targetUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: req.path,
      method: req.method,
      headers: req.headers,
      timeout: 5000, // 5 second timeout
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.status(proxyRes.statusCode || 200);
      Object.keys(proxyRes.headers).forEach((key) => {
        res.setHeader(key, proxyRes.headers[key]!);
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      res.status(504).json({ error: 'Gateway Timeout' });
    });

    proxyReq.on('error', (err) => {
      res.status(502).json({ error: 'Bad Gateway', message: err.message });
    });

    req.pipe(proxyReq);
  };
}
```

**WHAT:** Forwards requests to a backend with timeout and error handling.
**WHY:** Without these, the gateway hangs or crashes on backend failure.
**HOW:** `http.request` with `timeout`, plus event listeners for `timeout` and `error`.

### WRONG vs RIGHT in Step 4

| Without Fix | With Fix |
|-------------|----------|
| `timeout` missing | `timeout: 5000` set |
| No `timeout` listener | Returns 504 on slow backend |
| No `error` listener | Returns 502 on dead backend |

### Step 5: Main Application

```typescript
// src/index.ts
import express, { Request, Response } from 'express';
import { createProxyMiddleware } from './gateway.js';
import { requestLogger } from './logger.js';

const app = express();
const PORT = process.env.GATEWAY_PORT || 3000;

app.use(express.json());
app.use(requestLogger);

app.use('/users', createProxyMiddleware('http://localhost:3001'));
app.use('/orders', createProxyMiddleware('http://localhost:3002'));

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`API Gateway listening on port ${PORT}`);
  });
}

export { app };
```

### Step 6: Test

```bash
# Terminal 1: User service
node -e "require('http').createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({service:'user'}));}).listen(3001)"

# Terminal 2: Order service
node -e "require('http').createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({service:'order'}));}).listen(3002)"

# Terminal 3: Gateway
npm run dev

# Test
curl -i http://localhost:3000/users/profile
# → HTTP/1.1 200 OK
# → X-Request-ID: abc-123...
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
 src/logger.ts      src/gateway.ts      src/index.ts
    │                    │                    │
    └────────────────────┼────────────────────┘
                         ▼
                  npm run dev
                         │
                         ▼
                   Test with curl
```
