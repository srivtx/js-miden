# 08-CRITIQUE: Load Balancer

## WHAT would a senior engineer say?

This project demonstrates the concept of round-robin distribution but fails at the most important job of a load balancer: **knowing which backends are alive**. It is a traffic distributor, not a load balancer.

## WHY is this critique necessary?

A junior engineer might see "round-robin works in my test" and deploy this to production. Without health checks, it will cause intermittent failures that are hard to debug because the balancer itself appears healthy.

## HOW would a senior engineer fix this?

### 1. Fix Health Check Integration

**Current:** `startHealthChecks()` is empty; `selectBackend()` ignores health.
**Critique:** These are P0 bugs.
**Fix:** Filter by health in selection and start the health check interval on boot.

### 2. Add Grace Periods

**Current:** One failed health check marks a backend unhealthy.
**Critique:** Network blips will cause flapping.
**Fix:** Require 3 consecutive failures before marking unhealthy. Require 2 consecutive successes before marking healthy.

### 3. Add Connection Timeouts

**Current:** `http.request` to backend has no timeout.
**Critique:** A hanging backend will hang the balancer.
**Fix:** Add `timeout: 5000` to the proxy request.

### 4. Metrics and Observability

**Current:** No metrics.
**Critique:** You can't tune what you can't see.
**Fix:** Export:
- `balancer_requests_total` (counter)
- `balancer_backend_health` (gauge: 0 or 1)
- `balancer_request_duration_seconds` (histogram)

### 5. Graceful Shutdown

**Current:** `process.exit()` would drop in-flight requests.
**Critique:** Deploys become dangerous.
**Fix:** Listen for `SIGTERM`, stop accepting new requests, wait for active requests to finish, then exit.

### 6. Use a Production Load Balancer

**Current:** Custom Node.js balancer.
**Critique:** This is fine for learning, but HAProxy, Nginx, or a cloud LB provide years of battle-tested reliability.
**Fix:** For production, delegate to HAProxy, AWS ALB, or GCP LB.

## WRONG vs RIGHT

| Aspect | WRONG (Current) | RIGHT (Senior Review) |
|--------|-----------------|-----------------------|
| Health checks | Never started | `setInterval` every 5s with grace periods |
| Health filtering | None in `selectBackend()` | `backends.filter(b => b.healthy)` |
| Backend timeout | None | 5000ms timeout on proxy |
| Metrics | None | Prometheus metrics for health, RPS, latency |
| Graceful shutdown | None | SIGTERM handler with drain |
| Production use | Custom Node.js | HAProxy, Nginx, or cloud LB |

## ASCII Diagram: Production Load Balancer

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Load Balancer (HAProxy / AWS ALB / Custom)                  │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Health     │  │  Selection  │  │   Metrics           │  │
│  │  Checks     │  │  Algorithm  │  │   (Prometheus)      │  │
│  │  (grace)    │  │  (filtered) │  │                     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                      │             │
│         └────────────────┴──────────────────────┘             │
│                          │                                    │
│                   ┌──────┴──────┐                             │
│                   │   Proxy     │                             │
│                   │  Timeout    │                             │
│                   └──────┬──────┘                             │
└──────────────────────────┼────────────────────────────────────┘
                           │
                ┌──────────┼──────────┐
                ▼          ▼          ▼
            Backend 1  Backend 2  Backend 3
```

## Final Verdict

**Grade: C for learning, D for production readiness.**

The round-robin logic is correct, but the absence of health check integration makes this unsuitable for any real traffic. Fix the health bugs, add metrics, and then consider whether you really need a custom balancer.
