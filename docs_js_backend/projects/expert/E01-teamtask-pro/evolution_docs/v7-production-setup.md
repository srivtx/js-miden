# v7 — Production Setup

Your SaaS works locally. Tests pass. But production is a different universe. A deploy kills active requests. The database connection pool exhausts. Redis fails and the app crashes. You need resilience.

## Pain #1: Deploys Kill Active Requests

```typescript
// src/gateway/index.ts
app.listen(PORT, () => console.log('Listening'));
// No graceful shutdown. SIGTERM kills the process immediately.
// A user uploading a file loses it mid-upload.
// A task update is half-written to the database.
```

Kubernetes sends SIGTERM during rolling updates. Your app dies instantly. 5% of requests fail during every deploy.

## Pain #2: Resource Exhaustion

```typescript
// mongoose default connection
mongoose.connect(process.env.MONGODB_URI);
// Default pool size: 5. Under load, requests queue.
// Response time goes from 50ms to 5000ms.
// Users think the app is broken.
```

No connection pooling config. No query timeouts. A slow query blocks the pool indefinitely.

## Pain #3: Cascading Failures

```typescript
// task service calls auth service
const user = await fetch('http://auth-service:3001/validate', {
  headers: { authorization: req.headers.authorization },
});
// Auth service is down. fetch hangs for 2 minutes (default Node timeout).
// The task service request hangs too.
// The gateway request hangs too.
// The user's browser times out.
```

No circuit breaker. No timeout. One slow service takes down the entire request chain.

## Pain #4: No Health Checks

```typescript
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
  // Always returns ok, even if database is disconnected.
});
```

Kubernetes thinks the pod is healthy and sends traffic to it. But the database is down. Every request fails.

## The Fix: Production-Grade Setup

### Graceful Shutdown

```typescript
// src/utils/server.ts
import { Server } from 'http';
import { logger } from './logger.js';

export function setupGracefulShutdown(server: Server, cleanup: () => Promise<void>) {
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully');
    
    server.close(async () => {
      logger.info('HTTP server closed');
      await cleanup();
      logger.info('Cleanup complete');
      process.exit(0);
    });
    
    // Force shutdown after 30s
    setTimeout(() => {
      logger.error('Forced shutdown');
      process.exit(1);
    }, 30000);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
```

```typescript
// src/gateway/index.ts
import { setupGracefulShutdown } from './utils/server.js';
import { disconnectRedis } from './redis.js';
import { disconnectDatabase } from './database.js';

const server = app.listen(PORT, () => {
  logger.info(`Gateway listening on ${PORT}`);
});

setupGracefulShutdown(server, async () => {
  await disconnectRedis();
  await disconnectDatabase();
});
```

### Connection Pooling + Timeouts

```typescript
// src/database.ts
import mongoose from 'mongoose';

export async function connectDatabase(uri: string) {
  await mongoose.connect(uri, {
    maxPoolSize: 50,
    minPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 10000,
    bufferCommands: false, // Fail fast if disconnected
  });
}
```

```typescript
// src/task/services/task.ts
export class TaskService {
  async getTasksByProject(projectId: string, orgId: string) {
    return Task.find({ projectId, organizationId: orgId })
      .maxTimeMS(5000) // Query timeout
      .lean(); // Faster, return plain objects
  }
}
```

### Circuit Breaker for Cross-Service Calls

```typescript
// src/utils/circuitBreaker.ts
interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
}

class CircuitBreaker {
  private failures = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private lastFailureTime = 0;
  
  constructor(
    private fn: () => Promise<any>,
    private options: CircuitBreakerOptions
  ) {}
  
  async execute() {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.options.resetTimeoutMs) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await this.fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.options.failureThreshold) {
      this.state = 'open';
    }
  }
}
```

### Real Health Checks

```typescript
// src/gateway/index.ts
app.get('/health', async (req, res) => {
  const checks = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkAuthService(),
  ]);
  
  const unhealthy = checks.filter(c => !c.healthy);
  
  if (unhealthy.length > 0) {
    logger.warn({ unhealthy }, 'Health check failed');
    return res.status(503).json({
      status: 'unhealthy',
      checks: unhealthy.map(c => ({ name: c.name, error: c.error })),
    });
  }
  
  res.json({ status: 'healthy', checks: checks.map(c => c.name) });
});
```

### Environment-Based Config

```typescript
// src/config.ts
import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
});

export const config = ConfigSchema.parse(process.env);
```

## What Changed

| Before | After |
|--------|-------|
| Instant process death | 30s graceful shutdown with connection draining |
| Default DB pool (5) | Configured pool (10-50) with timeouts |
| Hanging cross-service calls | Circuit breaker with 5s timeout |
| Fake health check | Real dependency health checks |
| Hardcoded config | Environment-validated config with Zod |
| No memory limits | Container-aware resource limits |

## Production Checklist

- [ ] Graceful shutdown (SIGTERM handler)
- [ ] Connection pooling (DB, Redis)
- [ ] Query timeouts
- [ ] Circuit breakers for external calls
- [ ] Real health checks (deep, not shallow)
- [ ] Environment-based config with validation
- [ ] Structured logging with correlation IDs
- [ ] Request timeouts (HTTP + DB)
- [ ] Rate limiting per tenant
- [ ] Error boundaries (don't crash on unhandled errors)

## The Evolution

| Stage | State |
|-------|-------|
| v1 | In-memory array, no users |
| v2 | TypeScript types, compile-time safety |
| v3 | Zod validation, reject garbage at edge |
| v4 | Pino logging, trace requests across services |
| v5 | Vitest tests, prevent regressions |
| v6 | ESM modules, modern tooling |
| v7 | Production resilience, graceful degradation |

This is a production SaaS. It handles multi-tenancy, RBAC, real-time updates, file storage, and billing. It started as a 20-line Express app. Now it's a resilient, observable, secure platform.
