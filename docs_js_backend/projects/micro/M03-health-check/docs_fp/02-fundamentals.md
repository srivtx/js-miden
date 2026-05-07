# M03 Health Check: Fundamentals

## Strip the Libraries. Implement from Scratch.

You are not allowed to use `express`, `koa`, `fastify`, or any health check library. You have:

- Node.js built-in `http`
- A hypothetical `checkDatabase()` function that returns a Promise resolving to `{ healthy: boolean, latencyMs: number }`
- A hypothetical `checkCache()` function with the same signature

Build an HTTP server that exposes:

- `GET /health/live` — Liveness probe. Returns `200` if the Node.js process is alive.
- `GET /health/ready` — Readiness probe. Returns `200` only if all dependencies are healthy. Returns `503` otherwise.
- `GET /health` — Deep health check. Returns a JSON object with the status of every dependency.

## The Constraints

1. The readiness check must time out after 5 seconds. If a dependency does not respond in 5 seconds, it is unhealthy.
2. The readiness check must check dependencies in parallel, not serially.
3. If a dependency check throws an exception, catch it and mark that dependency as unhealthy. Do not crash the server.
4. The deep health check must include the exact latency of each dependency check.
5. The liveness check must not check any dependency. It must return as fast as possible.
6. If the readiness check fails, the response must include which dependency failed and why.

## Skeleton

```javascript
const http = require('http');

async function checkDatabase() {
  // Simulated check
  return { healthy: true, latencyMs: 12 };
}

async function checkCache() {
  // Simulated check
  return { healthy: true, latencyMs: 3 };
}

const server = http.createServer(async (req, res) => {
  // Implement /health/live, /health/ready, /health
});

server.listen(3000);
```

## Implementation Guide (Hidden)

<details>
<summary>Click to reveal</summary>

```javascript
const http = require('http');

async function checkDatabase() {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ healthy: true, latencyMs: 12 }), 12);
  });
}

async function checkCache() {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ healthy: true, latencyMs: 3 }), 3);
  });
}

function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ healthy: false, latencyMs: ms, error: `Timeout after ${ms}ms` });
    }, ms);

    promise.then((result) => {
      clearTimeout(timer);
      resolve(result);
    }).catch((err) => {
      clearTimeout(timer);
      resolve({ healthy: false, latencyMs: ms, error: err.message });
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/health/live') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'alive' }));
    return;
  }

  if (req.url === '/health/ready') {
    const checks = await Promise.all([
      withTimeout(checkDatabase(), 5000).then(r => ({ name: 'database', ...r })),
      withTimeout(checkCache(), 5000).then(r => ({ name: 'cache', ...r })),
    ]);

    const allHealthy = checks.every(c => c.healthy);
    const statusCode = allHealthy ? 200 : 503;

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: allHealthy ? 'ready' : 'not ready',
      checks: checks.reduce((acc, c) => {
        acc[c.name] = { healthy: c.healthy, latencyMs: c.latencyMs, error: c.error };
        return acc;
      }, {}),
    }));
    return;
  }

  if (req.url === '/health') {
    const start = Date.now();
    const checks = await Promise.all([
      withTimeout(checkDatabase(), 5000).then(r => ({ name: 'database', ...r })),
      withTimeout(checkCache(), 5000).then(r => ({ name: 'cache', ...r })),
    ]);
    const totalLatency = Date.now() - start;

    const allHealthy = checks.every(c => c.healthy);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: allHealthy ? 'healthy' : 'degraded',
      totalLatencyMs: totalLatency,
      checks: checks.reduce((acc, c) => {
        acc[c.name] = { healthy: c.healthy, latencyMs: c.latencyMs, error: c.error };
        return acc;
      }, {}),
    }));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(3000, () => {
  console.log('Health server listening on port 3000');
});
```

**Key techniques:**
- **`withTimeout` wrapper**: Converts a throwing or slow Promise into a resolved result with an `error` or `timeout` field. Never rejects.
- **`Promise.all` for parallel checks**: Serial checks add latency. Parallel checks add only the slowest dependency's latency.
- **Separate endpoints**: Liveness must be fast and dependency-free. Readiness must be strict. Deep health is for human operators.

</details>

## Why This Matters

Kubernetes, AWS ELB, and every orchestrator in existence use these exact patterns. The `livenessProbe`, `readinessProbe`, and `startupProbe` are not magic. They are HTTP calls to endpoints that you write. If you write them wrong, your infrastructure makes wrong decisions. If you understand the code, you can debug the infrastructure.
