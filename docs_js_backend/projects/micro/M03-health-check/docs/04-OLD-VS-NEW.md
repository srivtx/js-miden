# M03: Old vs Modern

## console.log Health vs Structured Health

### The Old Way: Console Logging

```typescript
// 2010-era health check
app.get('/health', (req, res) => {
  console.log('Health check received');
  
  db.query('SELECT 1', (err) => {
    if (err) {
      console.log('DB error: ' + err.message);
      res.status(500).send('not ok');
      return;
    }
    
    redis.ping((err) => {
      if (err) {
        console.log('Redis error: ' + err.message);
        res.status(500).send('not ok');
        return;
      }
      
      console.log('All healthy');
      res.status(200).send('ok');
    });
  });
});
```

**Problems:**
1. **Unstructured text** — `console.log` outputs plain strings. You cannot query "how many DB failures in the last hour?" from text logs without regex.
2. **Callback hell** — Nested callbacks for each dependency. Adding a third dependency means nesting deeper.
3. **No detail** — The response is just `"ok"` or `"not ok"`. You cannot tell which component failed without reading server logs.
4. **No caching** — Every request hits the database.
5. **Wrong status code** — `500` instead of `503`. `500` implies the server is broken; `503` implies the server is fine but unavailable.

### The Modern Way: Structured JSON

```typescript
// Modern health check
app.get('/health', async (_req, res) => {
  try {
    const health = await checkHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (_error) {
    res.status(503).json({
      status: 'unhealthy',
      checks: { database: 'unknown', redis: 'unknown' }
    });
  }
});
```

**Advantages:**
1. **Machine-parseable** — JSON can be ingested by Datadog, Splunk, Grafana directly.
2. **Async/await** — Flat, readable code. Parallel checks with `Promise.all`.
3. **Detailed** — Per-component status for instant debugging.
4. **Cached** — 5-second TTL reduces load.
5. **Correct semantics** — `503` for unavailability, `200` for health.

---

## Synchronous vs Asynchronous Health Checks

### The Old Way: Synchronous (Blocking)

In older systems, health checks sometimes used synchronous APIs:

```typescript
// Python-style synchronous check (conceptual)
// In Node.js, this would block the event loop
function checkHealthSync() {
  try {
    const dbResult = db.querySync('SELECT 1');  // BLOCKS entire process!
    const redisResult = redis.pingSync();        // BLOCKS entire process!
    return { status: 'healthy' };
  } catch (e) {
    return { status: 'unhealthy' };
  }
}
```

**Why this is catastrophic in Node.js:**

Node.js is single-threaded. While the event loop is waiting for `db.querySync()`, **no other request can be processed**:

```
Event Loop Timeline:

T+0ms:  Request A arrives ──▶ starts sync DB query
T+1ms:  Request B arrives ──▶ STUCK WAITING (event loop blocked)
T+2ms:  Request C arrives ──▶ STUCK WAITING
...
T+50ms: DB query returns ──▶ Request A responds
T+51ms: Request B finally starts processing
```

A single slow health check can make your entire application unresponsive.

### The Modern Way: Asynchronous (Non-Blocking)

```typescript
// Node.js: non-blocking async
app.get('/health', async (_req, res) => {
  // These initiate I/O and immediately yield the event loop
  const [dbOk, redisOk] = await Promise.all([
    db.query('SELECT 1').then(() => true).catch(() => false),
    redis.ping().then(() => true).catch(() => false),
  ]);
  
  // Event loop is free to process other requests while waiting for DB/Redis
});
```

**What the event loop sees:**

```
Event Loop Timeline:

T+0ms:   Request A arrives ──▶ starts DB query (I/O initiated, callback registered)
T+0.1ms: Request B arrives ──▶ starts processing immediately
T+0.2ms: Request C arrives ──▶ starts processing immediately
T+50ms:  DB query callback fires ──▶ Request A completes
```

**The async model allows thousands of concurrent connections with a single thread.** This is why Node.js scales well for I/O-bound workloads like web servers.

---

## Side-by-Side Comparison

| Aspect | Old (2010s) | Modern (2020s) |
|--------|-------------|----------------|
| **Output format** | Plain text (`"ok"`) | Structured JSON |
| **Logging** | `console.log` strings | Structured logging with correlation IDs |
| **Async style** | Callbacks | `async/await` with `Promise.all` |
| **HTTP semantics** | `200` or `500` | `200` or `503` |
| **Caching** | None | Time-based TTL cache |
| **Detail level** | Binary | Per-component status |
| **Observability** | Read server logs | Metrics, dashboards, automated alerts |
