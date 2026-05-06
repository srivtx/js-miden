# 08-CRITIQUE: Service Discovery

## WHAT would a senior engineer say?

This project demonstrates the registration/heartbeat/discovery lifecycle but has a **critical operational gap**: the cleanup job is disabled. In production, this would cause a gradual degradation that is hard to detect until it's too late.

## WHY is this critique necessary?

Service discovery is the nervous system of microservices. If it's lying about which services are alive, the entire system becomes unreliable. The current code is a time bomb.

## HOW would a senior engineer fix this?

### 1. Enable Cleanup Immediately

**Current:** `startCleanup()` is commented out.
**Critique:** This is a P0 bug. The registry is effectively a memory leak.
**Fix:** Uncomment the `setInterval` and start it on boot.

### 2. Add TTL Filtering at Query Time

**Current:** `getServices()` returns all entries.
**Critique:** Even if cleanup is enabled, a race condition between cleanup and discovery could return a stale entry.
**Fix:** Filter by TTL in `getServices()` as defense in depth.

### 3. Add Graceful Deregister

**Current:** Services can only be removed by TTL expiration.
**Critique:** A graceful shutdown should explicitly remove the service immediately.
**Fix:** Add `DELETE /deregister/:id` endpoint.

### 4. Replicate the Registry

**Current:** Single in-memory array.
**Critique:** If the registry node fails, all discovery stops.
**Fix:** Use Redis with TTL, or deploy Consul/etcd.

### 5. Add Health Check Endpoint on Services

**Current:** Heartbeat is just a timestamp update.
**Critique:** A service might be heartbeating but unable to serve requests (e.g., database connection is down).
**Fix:** The registry should probe a `/health` endpoint on services, not just accept heartbeats.

### 6. Add Metrics

**Current:** No metrics.
**Critique:** You can't alert on registry bloat.
**Fix:** Export `registry_services_total`, `registry_stale_services_total`, and `discovery_query_duration_seconds`.

## WRONG vs RIGHT

| Aspect | WRONG (Current) | RIGHT (Senior Review) |
|--------|-----------------|-----------------------|
| Cleanup | Disabled | `setInterval` every 1.5s |
| TTL filtering | None in `getServices()` | Filter at query time |
| Deregister | Not supported | `DELETE /deregister/:id` |
| Storage | In-memory array | Redis or Consul |
| Health validation | Timestamp only | Probe `/health` endpoint |
| Metrics | None | Prometheus gauges |

## ASCII Diagram: Production Discovery

```
Service A
    │
    │ POST /register
    │ Heartbeat every 10s
    │ DELETE /deregister (on shutdown)
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Service Registry (Consul / etcd / Redis)                    │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Cleanup    │  │  TTL Filter │  │   Health Probe      │  │
│  │  Job        │  │  (query)    │  │   (/health)         │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                      │             │
│         └────────────────┴──────────────────────┘             │
│                          │                                    │
│                   ┌──────┴──────┐                             │
│                   │   Replicated │                             │
│                   │   Store      │                             │
│                   └──────┬──────┘                             │
└──────────────────────────┼────────────────────────────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
                Client 1     Client 2
```

## Final Verdict

**Grade: B- for concept, F for operational readiness.**

The registration and heartbeat APIs are well-designed, but the disabled cleanup makes this a non-starter for production. Fix the cleanup, add TTL filtering, and then replace the entire thing with Consul or Kubernetes DNS.
