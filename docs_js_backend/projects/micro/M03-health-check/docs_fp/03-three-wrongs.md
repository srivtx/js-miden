# M03 Health Check: Three Wrongs

Below are three plausible but broken health check implementations. Each looks reasonable. Each will fail in production.

---

## Wrong #1: The Deep Liveness Check

```javascript
app.get('/health', async (req, res) => {
  const db = await checkDatabase();
  const cache = await checkCache();
  if (db.healthy && cache.healthy) {
    res.json({ status: 'ok' });
  } else {
    res.status(500).json({ status: 'error' });
  }
});
```

### Why It Looks Right
It checks everything. It returns an error if anything is wrong. It is thorough.

### Why It Destroys You
This endpoint is used as both liveness and readiness. The liveness probe is called every 10 seconds by the orchestrator. Every call checks the database and cache. If the database is under load, the health check adds load. If the health check times out, the orchestrator kills the pod. The pod restarts. The new pod also runs the health check. The database gets more load. More pods time out. More pods restart. This is a **health check death spiral**.

**The failure mode**: A minor database slowdown triggers a cascading restart of every pod. The cluster melts down during a recoverable blip.

---

## Wrong #2: The Serial Readiness Check

```javascript
app.get('/ready', async (req, res) => {
  const db = await checkDatabase();
  if (!db.healthy) {
    return res.status(503).json({ error: 'database' });
  }
  const cache = await checkCache();
  if (!cache.healthy) {
    return res.status(503).json({ error: 'cache' });
  }
  res.json({ status: 'ready' });
});
```

### Why It Looks Right
It fails fast. If the database is down, it does not bother checking the cache. It returns immediately.

### Why It Destroys You
During startup, every dependency must be checked before the pod is marked ready. If the database check takes 2 seconds and the cache check takes 2 seconds, the serial check takes 4 seconds. With 5 dependencies, it takes 10 seconds. The orchestrator's startup probe timeout is 5 seconds. The pod is never marked ready. It is killed and restarted. It is never ready. It is never started. It is a **zombie pod**.

**The failure mode**: The pod can never start because the readiness check is too slow. The deployment is permanently stuck.

---

## Wrong #3: The Exception-Crashing Health Check

```javascript
app.get('/health', async (req, res) => {
  const db = await checkDatabase();
  const cache = await checkCache();
  res.json({ db, cache });
});
```

### Why It Looks Right
It is clean. It returns the raw results. It trusts that `checkDatabase` and `checkCache` always resolve.

### Why It Destroys You
`checkDatabase` throws when the connection pool is exhausted. The exception is not caught. The Express error handler returns `500`. The orchestrator's liveness probe sees `500` and kills the pod. The pod restarts. The connection pool is still exhausted. The health check throws again. The pod is killed again. This is a **restart loop**.

Worse, if the exception crashes the process before the response is sent, the HTTP connection is dropped. The orchestrator sees a connection timeout, not a `500`. It waits for the probe timeout (30 seconds) before killing the pod. During those 30 seconds, the pod is still receiving traffic and crashing every request.

**The failure mode**: The health check becomes the primary source of process crashes. The pod spends more time restarting than serving traffic.

---

## The Pattern

| Wrong | Surface Appeal | Hidden Failure |
|-------|---------------|----------------|
| Deep liveness | Thorough, safe | Death spiral under load |
| Serial readiness | Fail-fast, simple | Startup timeout, zombie pods |
| Uncaught exceptions | Clean, minimal | Restart loops, dropped connections |

The correct solution separates concerns: liveness is shallow and fast, readiness is parallel and bounded, and all errors are caught and converted to structured responses.
