# M03: Thinking Process — Mental Models, Hot Path, Danger Zones

## Mental Model: The Health Check as a Circuit Breaker

Think of the `/health` endpoint as a **circuit breaker panel** in a house. Each switch represents a dependency (database, Redis, external API). If any switch trips, the whole house is considered unsafe for certain appliances.

```
┌─────────────────────────────────────────┐
│         HEALTH CHECK PANEL              │
├─────────────────────────────────────────┤
│  [APP]      ON  ●────────────────────   │
│  [DATABASE] ON  ●────────────────────   │
│  [REDIS]    OFF ○  TRIPPED!            │
├─────────────────────────────────────────┤
│  STATUS: UNHEALTHY (503)                │
└─────────────────────────────────────────┘
```

The load balancer does not care *why* the house is unsafe. It only cares that it should not send people into it.

## The Hot Path

The hot path is the code executed on every health check request. In our case, because we cache, the true hot path is actually the cache check:

```
Request arrives → Check cache age → If fresh, return cached result (microseconds)
                                          |
                                          └→ If stale, query DB + Redis (milliseconds)
```

The cache check is the 99.9% case. It must be:
1. **Lock-free** — Do not use a mutex around the cache; Node.js is single-threaded, and the cache is just two variables.
2. **Zero-allocation** — The cache hit path should not allocate new objects; it returns the reference to the cached object.

## Danger Zones

### Danger Zone 1: The Async Await Trap

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Request   │────▶│  db.query() │     │  redis.ping │
│   Arrives   │     │  (started)  │     │  (started)  │
└─────────────┘     └─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│ Response    │  ← SENT IMMEDIATELY, before either check finishes!
│ Status: 200 │
└─────────────┘
```

Without `await` (or `Promise.all`), the response races ahead of the actual checks. The checks complete later — into the void — and their results are ignored.

### Danger Zone 2: Timeout Cascades

If your health check timeout is **longer** than the load balancer's timeout:

```
Time ───────────────────────────────────────────────▶

LB sends health probe ──▶ App starts DB check
                              │
                              ▼ (5s timeout)
                         DB is slow (10s)
                              │
LB gives up at 5s ────────────┘ (marks unhealthy)
                              │
App finally gives up at 10s ──┘ (too late!)
```

The app thinks it timed out correctly, but the LB already made its decision. **Your timeout must be shorter than the caller's timeout.**

### Danger Zone 3: Cache Poisoning During Incident

If the DB goes down *right after* a successful health check, the cached "healthy" status persists for 5 seconds. During those 5 seconds, the load balancer continues routing traffic to a broken instance.

```
T+0ms:  Health check passes → cached as HEALTHY
T+50ms: Database crashes
T+500ms: User request arrives → routed to this instance (cache says healthy)
T+500ms: User request fails because DB is down
...
T+5000ms: Cache expires, next check fails, LB stops routing
```

**Why we accept this:** The alternative is no cache, which means every user request triggers database queries (since health checks and user requests share the same pool). That can DDOS the database. We trade a 5-second incident window for system stability.

## What-If Scenarios

### What if Redis is used only for caching, not core functionality?

Then Redis should be a **readiness** check, not a **liveness** check. The app can serve requests without cache (albeit slower). In that case, `/health` might return 200 even if Redis is down, but a separate `/ready` endpoint returns 503.

### What if the health check itself crashes the app?

If `db.query()` throws an uncaught exception, the entire Node.js process crashes. This is why we wrap it in `.catch()` and why `checkHealth()` uses `try/catch` in the route handler.

### What if there are 50 dependencies?

We do not check 50 dependencies synchronously in sequence — that would take 50 × timeout. We use `Promise.allSettled()` to run them in parallel and collect individual results.

### What if the database connection pool is exhausted?

If all connections are in use by user requests, the health check cannot get a connection and times out. The LB marks the instance unhealthy, removes it from rotation, and the existing requests finish, freeing connections. This is actually **desired behavior** — it creates backpressure.

## Thinking Checklist

Before writing a health check, ask:
1. Is this for load balancers, Kubernetes, or human debugging? (Different audiences need different detail levels.)
2. What is the timeout of the thing calling this endpoint?
3. How often will this be called? (Do I need caching?)
4. What happens if every dependency is down? (Should I still return a response, or crash?)
5. Are my checks read-only? (Never write data in a health check — you might corrupt state.)
