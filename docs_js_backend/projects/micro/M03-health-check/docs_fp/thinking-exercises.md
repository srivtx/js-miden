# M03 Health Check: Thinking Exercises

Answer these five questions **before** you write a single line of code.

---

## Question 1: The Startup Probe Dilemma

You have a service that takes 30 seconds to warm up. During startup, it cannot serve traffic. You configure a startup probe with `failureThreshold: 10` and `periodSeconds: 5` (total tolerance: 50 seconds). The readiness probe starts after the startup probe succeeds.

During a deployment, the new version has a bug: it crashes during startup after 20 seconds. The process restarts. It crashes again after 20 seconds. It restarts again.

What does the orchestrator do? Does the startup probe ever fail? What is the user-visible impact?

<details>
<summary>Discussion</summary>

The startup probe resets when the container restarts. The container crashes at 20 seconds, which is before the startup probe's 50-second tolerance. The orchestrator sees the container crash and restarts it. The startup probe never reaches `failureThreshold: 10` because the process dies before the 10th check.

The user-visible impact: the old pods are still running (they have not been terminated yet because the new pods have not passed startup). The deployment is stuck. If the old pods are also being drained, the cluster gradually loses capacity. Eventually, there are no healthy pods. The service is down.

The lesson: the startup probe does not catch startup crashes. It catches startup *slowness*. Crashes are handled by the liveness probe or the container restart policy. You need both.

</details>

---

## Question 2: The Thundering Herd

Your readiness probe checks the database. The database can handle 100 concurrent health check queries. You have 200 pods. The orchestrator checks readiness every 5 seconds on every pod.

What is the sustained QPS load on the database from health checks alone? What happens if the database slows down and health checks start taking 3 seconds instead of 10 ms?

<details>
<summary>Discussion</summary>

**Sustained QPS**: 200 pods * (1 check / 5 seconds) = 40 QPS. The database handles this easily.

**When database slows down**: Each check now holds a connection for 3 seconds. With 40 QPS and 3-second duration, the average concurrent health check connections is 40 * 3 = 120. The database limit is 100. Health checks start queuing. New health checks wait for connections. They take longer than 3 seconds. The readiness probe times out. Pods are marked not ready. The load balancer drains them. Traffic drops. The database load drops. Health checks speed up. Pods become ready. Traffic returns. The database slows down again. This is an **oscillating failure**.

The fix: use a dedicated, tiny connection pool for health checks. Cache the last health check result for 2 seconds. Do not check the database on every probe if the last check was recent.

</details>

---

## Question 3: The Liveness Trap

A pod is in a restart loop. The liveness probe fails. The container is killed and restarted. You investigate and find that the liveness probe checks an in-memory cache. The cache is populated asynchronously on startup. If the cache population takes 5 seconds, and the liveness probe runs after 3 seconds, the cache is empty. The liveness probe fails. The container is killed. The cache never populates.

How do you fix this? Should the liveness probe check the cache at all?

<details>
<summary>Discussion</summary>

The liveness probe should not check the cache. Liveness answers: "Is the process alive?" The process is alive even if the cache is not yet populated. Readiness answers: "Is the pod ready to serve traffic?" The pod is not ready until the cache is populated.

The fix:
1. Remove the cache check from the liveness probe.
2. Add the cache check to the readiness probe.
3. Use a startup probe if cache population is part of startup.
4. Ensure the liveness probe has an `initialDelaySeconds` long enough for the process to start.

The deeper lesson: liveness probes should be minimal. Any check that can fail due to startup timing or transient state belongs in readiness or startup.

</details>

---

## Question 4: The Partial Degradation

Your service depends on:
- Database (required)
- Cache (optional, improves latency)
- External payment API (required for checkout only)

The cache goes down. Should the readiness probe fail? Should the service stop serving traffic? What about the payment API — if it is down, should non-checkout endpoints still work?

<details>
<summary>Discussion</summary>

**Cache**: If the cache is optional, the readiness probe should not fail. The service serves traffic without caching. However, you might want to alert on cache unavailability so an operator can fix it. Consider a "degraded" status in the deep health check, but keep readiness `200`.

**Payment API**: If the payment API is only needed for checkout, the readiness probe should not fail for the whole service. But the checkout endpoint should return `503` or a specific error. This requires endpoint-level readiness, not service-level readiness.

**The design**:
- `/health/ready` checks only hard dependencies (database).
- `/health/deep` checks all dependencies and reports status per endpoint.
- The load balancer routes traffic based on `/health/ready`.
- The application gates specific endpoints based on their own dependency checks.

</details>

---

## Question 5: The Health Check Cache

You decide to cache the readiness check result for 5 seconds to reduce database load. The cache is an in-memory variable:

```javascript
let cachedResult = null;
let cachedAt = 0;

app.get('/ready', async (req, res) => {
  if (Date.now() - cachedAt < 5000) {
    return res.status(cachedResult).send();
  }
  const healthy = await checkDatabase();
  cachedResult = healthy ? 200 : 503;
  cachedAt = Date.now();
  res.status(cachedResult).send();
});
```

What happens during a rolling deployment with 10 pods? Pod 1 is replaced. It starts up. Its cache is empty. It checks the database. The database is fine. It caches `200`. Pod 2 is replaced. Same thing. All 10 pods are replaced. The database is never overloaded.

Now, what happens if the database fails between cache refreshes? How long does it take for the infrastructure to notice? What is the worst-case delay?

<details>
<summary>Discussion</summary>

If the database fails immediately after a cache refresh, the worst-case delay is just under 5 seconds. The next request to `/ready` will use the stale cached result (`200`) for up to 5 seconds. During that time, the load balancer continues routing traffic to the pod. Requests to the pod will fail because the database is down.

**Blast radius**: For 5 seconds, every request to that pod fails. With 10 pods, the impact depends on load balancing. If traffic is evenly distributed, ~10% of requests fail for 5 seconds.

**Trade-off**: Caching reduces database load but increases the time to detect failure. In a 10-pod cluster, the uncached load is only 10 QPS (10 pods * 1 check / 10 seconds). Caching is unnecessary and harmful here. In a 1,000-pod cluster, uncached load is 1,000 QPS. Caching is necessary, but the cache TTL should be tuned to the acceptable detection delay.

**The formula**: `maxAcceptableFailureRate * totalTraffic * cacheTTL = maxAcceptableFailedRequests`. Solve for `cacheTTL`.

</details>
