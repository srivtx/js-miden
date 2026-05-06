# M03: Deep Concepts

## Connection Pooling: WHY We Need It, WHAT Happens Without It

### The Naive Approach: One Connection Per Request

```typescript
import { Client } from 'pg';

// WITHOUT POOLING — creates a new TCP connection every time
async function query(sql: string) {
  const client = new Client({ host: 'localhost', database: 'mydb' });
  await client.connect();     // TCP handshake + TLS + PostgreSQL auth (~50-200ms)
  const result = await client.query(sql);
  await client.end();         // TCP teardown
  return result;
}
```

**What happens under load:**

```
Request 1: connect ──▶ query ──▶ disconnect
Request 2: connect ──▶ query ──▶ disconnect
Request 3: connect ──▶ query ──▶ disconnect
```

Each connection requires:
1. **TCP three-way handshake** (~1 RTT)
2. **TLS negotiation** (if enabled, ~2 RTT)
3. **PostgreSQL authentication** (password verification, ~1-5ms)
4. **TCP teardown** (FIN/ACK exchange)

At 100 requests per second, you create and destroy 100 TCP connections per second. PostgreSQL has a hard limit on concurrent connections (default `max_connections = 100`). You will exhaust the database.

### With Connection Pooling

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  database: 'mydb',
  max: 20,        // maximum 20 connections in the pool
  idleTimeoutMillis: 30000,  // close idle connections after 30s
});

// Reuses an existing connection, or waits for one to become free
const result = await pool.query('SELECT 1');
```

**What happens under load:**

```
Pool (max 20 connections):
┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
│ C1│ C2│ C3│ C4│ C5│ C6│ C7│ C8│ C9│C10│C11│C12│C13│C14│C15│C16│C17│C18│C19│C20│
└───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘
   ↑   ↑
   │   │
 Req1 Req2 (requests grab available connections, return them when done)
```

**Why pooling is essential:**
1. **Eliminates connection overhead** — Reusing a connection is microseconds, not milliseconds.
2. **Prevents DB exhaustion** — The pool caps concurrent connections at 20 instead of unbounded.
3. **Provides backpressure** — If all 20 connections are busy, the 21st request waits. This prevents the database from being overwhelmed.
4. **Connection warmup** — The pool can pre-create connections so the first request is fast.

### What Happens When the Pool Is Exhausted?

```
Pool state: [IN_USE] [IN_USE] [IN_USE] ... all 20 connections busy

Request 21 arrives ──▶ Waits in queue ──▶ (connectionTimeoutMillis: 5000)
                                         │
                                         ▼
                              If no connection frees in 5s:
                              Throw timeout error
```

This is **good**. The request fails fast instead of hanging forever. The load balancer can retry another instance.

---

## Health Check Patterns

### Pattern 1: Binary Healthy/Unhealthy

```json
{ "status": "healthy" }
```

**Use case:** Simple load balancer checks. Minimal parsing overhead.

### Pattern 2: Detailed Per-Component

```json
{
  "status": "unhealthy",
  "checks": {
    "database": { "status": "ok", "responseTimeMs": 12 },
    "redis": { "status": "error", "message": "Connection refused" }
  }
}
```

**Use case:** Human debugging, monitoring dashboards, alerting systems that need to know *which* component failed.

### Pattern 3: Health Score

```json
{
  "status": "degraded",
  "score": 0.67,
  "checks": {
    "database": { "status": "ok", "weight": 0.5 },
    "redis": { "status": "ok", "weight": 0.3 },
    "cache": { "status": "error", "weight": 0.2 }
  }
}
```

**Use case:** Sophisticated load balancers that can do weighted routing. "Cache is down, but core DB is up — send 80% of traffic here."

### Our Pattern

We use **Pattern 2** (detailed per-component) because it balances machine readability with human debugging needs.

---

## Kubernetes Probes

Kubernetes has three probe types:

```
┌─────────────────────────────────────────────────────────────┐
│                     KUBERNETES POD LIFECYCLE                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Startup Probe ──▶ Readiness Probe ──▶ Liveness Probe      │
│        │                  │                  │               │
│        ▼                  ▼                  ▼               │
│   "Is the app         "Is the app         "Should we        │
│    fully started?"    ready for           restart it?"      │
│                       traffic?"                             │
│                                                             │
│   Failure:              Failure:            Failure:         │
│   Kill pod and          Remove from         Kill pod and     │
│   restart               service endpoints   restart          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

| Probe | Purpose | Typical Endpoint | Action on Failure |
|-------|---------|------------------|-------------------|
| **Startup** | Give slow-starting apps time to initialize | `/health` or custom | Kill container |
| **Readiness** | Control traffic routing | `/health` | Remove from service endpoints |
| **Liveness** | Detect deadlocks and infinite loops | lightweight `/live` | Kill container |

**Why separate them?**

Imagine an app that takes 30 seconds to warm up its cache. During those 30 seconds:
- **Liveness** should pass (the process is not deadlocked).
- **Readiness** should fail (it is not ready to serve traffic yet).
- Kubernetes will not send traffic to it, but it will not restart it either.

Our single `/health` endpoint is effectively a combined readiness + liveness check. In production, you would likely split these.

---

## Timeouts: The Most Misunderstood Concept

### Why Timeouts Exist

Without a timeout, a network request can hang forever:

```
Request ──▶ Network partition ──▶ ? ? ?
                                   (waits forever)
```

This is worse than a fast failure because:
1. The caller waits indefinitely, holding resources (memory, threads, connections).
2. The caller cannot tell if the service is slow or dead.
3. Resource exhaustion cascades to other requests.

### Timeout Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Client (Browser)                                           │
│  └─ fetch() timeout: 30s (browser default)                  │
│                                                             │
│  Load Balancer                                              │
│  └─ Health check timeout: 5s                                │
│  └─ Request timeout: 60s                                    │
│                                                             │
│  Application (Node.js)                                      │
│  └─ DB connection timeout: 5s                               │
│  └─ Redis timeout: 5s                                       │
│                                                             │
│  Database (PostgreSQL)                                      │
│  └─ statement_timeout: 30s                                  │
└─────────────────────────────────────────────────────────────┘
```

**The Golden Rule:**

> Every timeout must be shorter than the timeout of the layer above it.

If your LB timeout is 5s but your DB timeout is 10s, the LB will give up and retry while your app is still waiting. This causes cascading load.

**Our configuration:**
- LB health check: 5s (configured in infrastructure, not code)
- App DB connection timeout: 5s
- App Redis timeout: 5s

These are equal, which is acceptable because the app should respond *before* the LB gives up. In practice, you might set app timeouts to 4s to be safe.
