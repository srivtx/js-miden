# M03: Problem Definition — Health Check with DB

## WHAT

Build a single HTTP endpoint (`GET /health`) that reports whether the application and its critical dependencies are alive and capable of serving traffic.

The response must be machine-parseable JSON:

```json
{
  "status": "healthy | unhealthy",
  "checks": {
    "database": "ok | error",
    "redis": "ok | error"
  }
}
```

HTTP status code semantics:
- `200 OK` — everything is working
- `503 Service Unavailable` — at least one dependency is failing

## WHY This Exists

### The Load Balancer Problem

In a production environment, no application runs in a vacuum. Traffic arrives through a load balancer (AWS ALB, nginx, Kubernetes Ingress, etc.). The load balancer must know **which instances can receive traffic** and **which should be drained**.

Without a health check, the load balancer has two bad choices:
1. **Send traffic to a broken instance** → Users see 500 errors
2. **Never send traffic anywhere** → Total outage

The `/health` endpoint is the **contract** between your application and the infrastructure that runs it.

### Why Check Dependencies?

A Node.js process can be running while PostgreSQL is down. The process is "alive" but **useless** — every request that needs the database will fail. A shallow health check ("is the process running?") is a lie that wastes user requests and wastes engineering time during incidents.

### The Debugging Problem

During an incident at 3 AM, an on-call engineer needs to know:
- Is the app itself broken?
- Is the database the problem?
- Is Redis the problem?

A detailed health response answers this in one `curl` command instead of SSHing into three different servers.

## Constraints

| Constraint | Rationale |
|------------|-----------|
| Must check PostgreSQL with `SELECT 1` | A TCP connection to port 5432 only proves the OS is listening. `SELECT 1` proves PostgreSQL accepted the connection, parsed the query, and executed it. |
| Must check Redis with `PING` | Same reasoning — a TCP handshake is not enough. `PING`/`PONG` proves the Redis server is responsive. |
| Must return within 5 seconds | Load balancers have their own timeouts (often 5s). If your health check is slower, the LB marks you unhealthy for being slow, even if you're fine. |
| Must cache result for 5 seconds | Health checks are called frequently (every 5–30s per instance by the LB, plus monitoring systems). Hammering the database with `SELECT 1` thousands of times per minute is wasteful and can itself cause outages. |
| Must use `503` for unhealthy | HTTP semantics matter. `503` explicitly tells clients: "I am not dead, but I cannot serve you right now. Try another instance or retry later." |

## Anti-Requirements (What We Deliberately Do NOT Do)

| Anti-Requirement | Why We Skip It |
|------------------|----------------|
| **No readiness probe logic** | Kubernetes distinguishes liveness ("restart this pod") from readiness ("stop sending traffic"). This endpoint is a simplified combined check. In real systems, you often need separate `/live` and `/ready` endpoints. |
| **No disk space check** | Important in production, but adds OS-level coupling that complicates this learning exercise. |
| **No dependency dependency checks** | We do not check "database can reach its replication follower" — that is the database's responsibility, not ours. |
| **No authentication on `/health`** | Load balancers and orchestrators cannot authenticate. Public health endpoints are standard. (In zero-trust environments, you might IP-restrict them.) |

## The Hidden Danger

The simplest health check implementation is deceptively easy:

```typescript
// WRONG: Looks correct, always returns 200
app.get('/health', (_req, res) => {
  db.query('SELECT 1');   // fire-and-forget!
  redis.ping();           // fire-and-forget!
  res.json({ status: 'healthy' });
});
```

This compiles, runs, and **always returns 200**, even when the database is down. The bug is that the async operations are not awaited — they are initiated but the response is sent before they complete. This is the central bug of this project and why "health check" is a deeper topic than it appears.
