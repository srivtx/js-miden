# M03 Health Check: The Incident

## 4:02 AM — The Load Balancer Massacre

You are on-call. The primary API cluster is being drained. The orchestrator is terminating all 40 pods, one by one. New pods are starting and immediately being killed. The rolling deployment is stuck. Customers see `503 Service Unavailable` for 90% of requests.

You check the health check endpoint: `/health`

```javascript
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});
```

It returns `200 OK`. Always. It does not check the database. It does not check the cache. It does not check anything.

## Hidden Culprit

The deployment happened 30 minutes ago. The new version has a bug: it connects to the database using a connection pool size of 100, but the PostgreSQL server has a `max_connections` of 80. The new pods start, exhaust the database immediately, and every subsequent query hangs.

But `/health` does not query the database. It returns `200 OK`. The load balancer thinks the pod is healthy. It routes traffic to it. Every request to that pod times out. The load balancer retries on another pod. That pod also times out. The retry cascade amplifies until the entire cluster is retry-storming itself to death.

The orchestrator's liveness probe is also `/health`. Since it always returns `200`, the orchestrator never restarts the pod. The pod stays alive, serving timeouts, forever.

## The Fix (Hidden)

<details>
<summary>Click to reveal</summary>

1. **Implement a deep health check**:
   ```javascript
   app.get('/health', async (req, res) => {
     const checks = await Promise.all([
       checkDatabase(),
       checkCache(),
       checkExternalAPI(),
     ]);
     const allHealthy = checks.every(c => c.healthy);
     res.status(allHealthy ? 200 : 503).json({
       status: allHealthy ? 'healthy' : 'unhealthy',
       checks: checks.reduce((acc, c) => ({ ...acc, [c.name]: c }), {}),
     });
   });
   ```

2. **Separate liveness from readiness**:
   - `/health/live` — Is the process running? Returns `200` if the event loop is not blocked.
   - `/health/ready` — Can the pod serve traffic? Returns `200` only if all dependencies are up.

3. **Add a startup probe**:
   The orchestrator should not mark the pod as ready until the startup probe passes. This gives the pod time to warm up connections without receiving traffic.

4. **Add a circuit breaker on the client**:
   If `/health/ready` returns `503`, the load balancer should stop routing traffic. If it returns `503` for 60 seconds, the orchestrator should kill the pod.

5. **Set `max_connections` in the app to match the database**:
   ```javascript
   const pool = new Pool({
     max: Math.floor(80 / numberOfPods), // Leave headroom
   });
   ```

</details>

## Post-Incident Review

| Question | Answer |
|----------|--------|
| Why did the cluster collapse? | Shallow health checks hid a critical dependency failure. The LB routed traffic to broken pods. |
| Why did the orchestrator not restart pods? | The liveness probe was the same as the readiness probe and always passed. |
| What monitoring gap existed? | No alert for database connection pool exhaustion. No metric for query timeout rate. |
| What architectural flaw? | Health checks were an afterthought, not a first-class system design concern. |

## The Real Lesson

A health check that always returns `200` is not a health check. It is a lie. It tells your infrastructure that everything is fine when the building is on fire. The most expensive bugs are not the ones that crash the system. They are the ones that keep the system alive just long enough to destroy everything else.
