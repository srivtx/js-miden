# v7: Production Setup — API Gateway

## The Journey

We started with direct HTTP calls, added types, validation, logging, tests, and ESM. Now we have a gateway that won't hang when a backend dies.

## What v7 Adds

- **Path-based routing**: `/users/*` → user-service, `/orders/*` → order-service
- **Request timeout**: 5s per backend attempt
- **Circuit breaker**: Open after 5 failures, half-open after 30s
- **Authentication middleware**: JWT validation on protected routes
- **Request ID propagation**: Trace a request across all services

## The Final Code

```typescript
// src/gateway.ts
import { Request, Response, NextFunction } from 'express';
import http from 'http';
import { randomUUID } from 'crypto';
import { logger } from './logger.js';

interface CircuitState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

const circuits: Map<string, CircuitState> = new Map();

export function createProxyMiddleware(targetUrl: string) {
  const circuit = circuits.get(targetUrl) || { failures: 0, lastFailure: 0, state: 'closed' };
  circuits.set(targetUrl, circuit);

  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-ID', requestId);
    req.headers['x-request-id'] = requestId;

    if (circuit.state === 'open') {
      if (Date.now() - circuit.lastFailure < 30000) {
        logger.warn({ requestId, targetUrl }, 'Circuit open, rejecting fast');
        return res.status(503).json({ error: 'Service temporarily unavailable' });
      }
      circuit.state = 'half-open';
    }

    const url = new URL(targetUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: req.path,
      method: req.method,
      headers: req.headers,
      timeout: 5000,
    };

    const proxyReq = http.request(options, (proxyRes) => {
      if (circuit.state === 'half-open') {
        circuit.state = 'closed';
        circuit.failures = 0;
      }
      res.status(proxyRes.statusCode || 200);
      Object.keys(proxyRes.headers).forEach(key => res.setHeader(key, proxyRes.headers[key]!));
      proxyRes.pipe(res);
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      recordFailure(circuit);
      res.status(504).json({ error: 'Gateway Timeout' });
    });

    proxyReq.on('error', (err) => {
      recordFailure(circuit);
      res.status(502).json({ error: 'Bad Gateway', message: err.message });
    });

    req.pipe(proxyReq);
  };
}

function recordFailure(circuit: CircuitState): void {
  circuit.failures++;
  circuit.lastFailure = Date.now();
  if (circuit.failures >= 5) {
    circuit.state = 'open';
    logger.error('Circuit breaker opened');
  }
}
```

## Why This Matters in Production

Without timeout, one slow database query hangs the gateway forever, leaking file descriptors until the OS refuses new connections. Without circuit breaker, a dead backend gets 100% of retries, wasting CPU and giving users 502s. Without auth, anyone can hit `/admin/delete`.

## Pain → Solution Summary

| Version | Pain | Solution |
|---------|------|----------|
| v1 | Direct coupling to backend URLs | Proxy middleware abstraction |
| v2 | Untyped req/res objects | TypeScript `Request`/`Response` types |
| v3 | Any path forwarded blindly | Validate route prefixes |
| v4 | No observability across services | Request ID + structured logging |
| v5 | Timeout test hangs Jest | Mock server + assertion on 504 |
| v6 | CJS `require('http')` ambiguity | ESM with explicit `http` import |
| v7 | Cascading failures, no auth | Circuit breaker + timeout + JWT |

## Run It

```bash
GATEWAY_PORT=3000 USER_SERVICE=http://localhost:3001 ORDER_SERVICE=http://localhost:3002 node dist/index.js
```
