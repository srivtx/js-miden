# 03-CONCEPTS: Load Balancer

## WHAT is a Load Balancer?

A Load Balancer distributes incoming network traffic across multiple backend servers. It acts as a **traffic cop**, ensuring no single server is overwhelmed while hiding failures from clients.

## WHY do we need it?

| Without LB | With LB |
|------------|---------|
| Single point of failure | Multiple backends share load |
| No scaling mechanism | Add backends dynamically |
| Direct exposure to backend failures | Failed backends removed automatically |
| Uneven resource usage | Even distribution (or weighted) |

## HOW does it work?

### Core Loop

```
┌──────────┐
│  Client  │
└────┬─────┘
     │ GET /
     ▼
┌─────────────────────────┐
│   Load Balancer :3000   │
│  ┌───────────────────┐  │
│  │ 1. Health Filter  │  │
│  │ 2. Select Backend │  │
│  │ 3. Proxy Request  │  │
│  └───────────────────┘  │
└──────────┬──────────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
┌─────────┐  ┌─────────┐
│Backend 1│  │Backend 2│
│ :3001   │  │ :3002   │
│ healthy │  │ healthy │
└─────────┘  └─────────┘
```

1. **Health Filter**: Remove backends where `healthy === false`.
2. **Selection**: Pick the next backend in the rotation.
3. **Proxy**: Forward the request and stream the response.

### Round-Robin Algorithm

```
Request 1 ──▶ Backend 1
Request 2 ──▶ Backend 2
Request 3 ──▶ Backend 3
Request 4 ──▶ Backend 1  (wraps around)
```

## WRONG vs RIGHT

### Wrong: Blind Round-Robin

```typescript
function selectBackend() {
  const backend = backends[counter % backends.length];
  counter++;
  return backend; // May return a dead server!
}
```

**Why Wrong:**
- **Intermittent errors**: Clients see 502 on every nth request.
- **No recovery**: When a backend comes back, traffic isn't automatically restored.
- **False uptime**: The system appears "up" but serves errors.

### Right: Health-Aware Round-Robin

```typescript
function selectBackend() {
  const healthy = backends.filter(b => b.healthy);
  if (healthy.length === 0) return null;
  const backend = healthy[counter % healthy.length];
  counter++;
  return backend;
}

// Health checks run every 5 seconds
setInterval(async () => {
  for (const backend of backends) {
    const ok = await checkHealth(backend.port);
    setBackendHealth(backend.port, ok);
  }
}, 5000);
```

**Why Right:**
- **Automatic failover**: Dead backends are skipped immediately.
- **Automatic recovery**: When `/health` returns 200, the backend is re-added.
- **Clear all-down state**: Returns 503 when no backends are available.

## Key Concepts

| Concept | Definition |
|---------|------------|
| Round-Robin | Cycles through backends in order. |
| Health Check | Periodic probe to verify a backend is responsive. |
| Grace Period | N consecutive failures before marking unhealthy (prevents flapping). |
| Recovery Threshold | M consecutive successes before marking healthy again. |
| 503 Service Unavailable | Returned when all backends are down. |

## ASCII Diagram: Health-Aware Routing

```
Backends:
┌─────────┐  ┌─────────┐  ┌─────────┐
│  :3001  │  │  :3002  │  │  :3003  │
│ healthy │  │  DOWN   │  │ healthy │
└────┬────┘  └─────────┘  └────┬────┘
     │                         │
     └───────────┬─────────────┘
                 ▼
          ┌─────────────┐
          │ Load Balancer│  ← Only routes to :3001 and :3003
          └─────────────┘
```
