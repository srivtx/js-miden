# 03-CONCEPTS: API Gateway

## WHAT is an API Gateway?

An API Gateway is a **reverse proxy with policy enforcement**. It is the single entry point for all client requests into a microservices architecture. It routes, transforms, authenticates, and protects downstream services.

## WHY do we need it?

| Without Gateway | With Gateway |
|-----------------|--------------|
| Clients know every service URL | Clients know one URL |
| Auth logic duplicated in N services | Auth at the edge |
| No request tracing | Trace ID injected at edge |
| Each service handles SSL | SSL terminated at gateway |
| Direct DDoS exposure | Rate limiting at edge |

## HOW does it work?

### Request Flow

```
Client
  │
  ▼
┌─────────────────────────────────────────┐
│  API Gateway                            │
│  ┌─────────┐ ┌─────────┐ ┌───────────┐ │
│  │ Logger  │ │ Auth    │ │ Router    │ │
│  └────┬────┘ └────┬────┘ └─────┬─────┘ │
│       └─────────────┴────────────┘       │
│                   │                      │
│              ┌────┴────┐                 │
│              │ Proxy   │                 │
│              │ Timeout │                 │
│              │ Error   │                 │
│              └────┬────┘                 │
└───────────────────┼─────────────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
    ┌───────┐   ┌───────┐   ┌───────┐
    │Users  │   │Orders │   │Auth   │
    └───────┘   └───────┘   └───────┘
```

1. **Receive**: Client sends `GET /users/profile`.
2. **Log**: Record method, path, timestamp, request ID.
3. **Route**: Match `/users/*` → `http://localhost:3001`.
4. **Proxy**: Open HTTP connection to backend with timeout.
5. **Handle errors**: Return 502 (down) or 504 (slow).
6. **Respond**: Stream backend response to client.

## WRONG vs RIGHT

### Wrong: Naive Proxy

```typescript
// No timeout, no error handler
const proxyReq = http.request(options, (proxyRes) => {
  res.status(proxyRes.statusCode || 200);
  proxyRes.pipe(res);
});
req.pipe(proxyReq); // If backend hangs, client hangs forever
```

**Why Wrong:**
- **Resource leak**: Open sockets accumulate until the OS limit is hit.
- **Bad UX**: Client sees an infinite spinner.
- **No observability**: You can't distinguish "backend down" from "backend slow."

### Right: Resilient Proxy

```typescript
const proxyReq = http.request({ ...options, timeout: 5000 }, (proxyRes) => {
  res.status(proxyRes.statusCode || 200);
  proxyRes.pipe(res);
});

proxyReq.on('timeout', () => {
  proxyReq.destroy();
  res.status(504).json({ error: 'Gateway Timeout' });
});

proxyReq.on('error', (err) => {
  res.status(502).json({ error: 'Bad Gateway', message: err.message });
});

req.pipe(proxyReq);
```

**Why Right:**
- **Bounded latency**: Client gets a response within 5 seconds.
- **Clear errors**: 502 vs 504 tells operations exactly what's wrong.
- **Resource safety**: Destroying the request frees the socket.

## Key Concepts

| Concept | Definition |
|---------|------------|
| Reverse Proxy | Forwards client requests to backends and returns responses. |
| Timeout | Maximum time to wait for a backend response before aborting. |
| Circuit Breaker | Stops sending traffic to a failing backend for a cooldown period. |
| Request ID | Unique identifier for correlating logs across services. |
| Rate Limiting | Restricting the number of requests per client per time window. |

## ASCII Diagram: Timeout Handling

```
Client                    Gateway                   Backend
  |                         |                         |
  |---- GET /users -------->|                         |
  |                         |---- GET /users -------->|
  |                         |                         | (slow query)
  |                         |    [timer: 5000ms]      |
  |                         |    TIMEOUT!             |
  |                         |    destroy()            |
  |                         |                         |
  |<--- 504 Gateway Timeout-|                         |
  |  { error: "Timeout" }   |                         |
```
