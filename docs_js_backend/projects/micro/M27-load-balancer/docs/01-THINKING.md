# 01-THINKING: Load Balancer

## WHAT is the mental model?

A Load Balancer is a **traffic cop with a medical degree**. It doesn't just direct cars; it checks if the roads are open. The core abstraction is: **only route to backends you have proven are alive within the last N seconds**.

## WHY does this mindset matter?

In distributed systems, failure is the default. Servers crash, deploys roll out, networks partition. A load balancer that assumes all backends are healthy is worse than no load balancer at all—it adds a point of failure while providing no benefit.

## HOW do we reason about load balancer design?

### The Health Contract

1. **Probe**: Send a lightweight request (e.g., `GET /health`) every 5 seconds.
2. **Record**: Update `backend.healthy` based on the response.
3. **Filter**: Only select from backends where `healthy === true`.
4. **Grace**: Allow N consecutive failures before marking unhealthy (avoids flapping).
5. **Recover**: Require M consecutive successes before marking healthy again.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Backend 1  │     │  Backend 2  │     │  Backend 3  │
│   :3001     │     │   :3002     │     │   :3003     │
│   healthy   │     │  UNHEALTHY  │     │   healthy   │
└──────┬──────┘     └─────────────┘     └──────┬──────┘
       │                                        │
       └──────────────┬─────────────────────────┘
                      ▼
              ┌───────────────┐
              │ Load Balancer │  ← Only routes to 1 & 3
              └───────────────┘
```

## WRONG vs RIGHT Thinking

| WRONG Mindset | RIGHT Mindset |
|---------------|---------------|
| "Round-robin is enough." | "Round-robin without health checks is Russian roulette." |
| "If a backend fails, we'll restart it." | "The balancer must detect and route around failures automatically." |
| "Health checks add overhead." | "Health checks are the cheapest insurance against downtime." |
| "One failure = unhealthy." | "Use thresholds to avoid flapping and thundering herds." |

## Decision Checklist

- [ ] Is there an active health check probe?
- [ ] Does `selectBackend()` filter by health status?
- [ ] Is there a grace period before marking unhealthy?
- [ ] Is there a recovery threshold before marking healthy?
- [ ] Does the balancer return 503 when all backends are down?
