# 00-PROBLEM: API Gateway

## WHAT is the problem?

An API Gateway is the single entry point for all client traffic into a microservices architecture. The problem is that **without proper timeout and error handling**, a single slow or dead backend can cascade into a full gateway outage, hanging client connections forever and leaking system resources.

## WHY does this matter?

- **Resource exhaustion**: Every hanging request consumes a file descriptor and memory. At scale, this exhausts the OS limit (`ulimit -n`) and crashes the gateway.
- **Client experience**: Users see infinite spinners instead of clear error messages. Mobile apps may retry aggressively, amplifying the load.
- **Cascading failure**: If the gateway has no timeout, a downstream database slowdown can back up into the gateway, then into load balancers, then into clients—a classic cascading failure.

## HOW does the bug manifest?

The current `src/gateway.ts` uses `http.request()` with **no timeout** and **no error handler**:

```typescript
const proxyReq = http.request(options, (proxyRes) => {
  res.status(proxyRes.statusCode || 200);
  proxyRes.pipe(res);
});
// No .on('timeout') ...
// No .on('error') ...
```

## WRONG vs RIGHT

| Aspect | WRONG (Current) | RIGHT (Fixed) |
|--------|-----------------|---------------|
| Timeout | Not set | `timeout: 5000` |
| Error handler | Missing | `.on('error', ...)` returning 502 |
| Timeout handler | Missing | `.on('timeout', ...)` returning 504 |
| Client response | Hangs forever | Clear HTTP status + JSON error |

## ASCII Diagram: The Hanging Gateway

```
Client                    Gateway                   Backend
  |                         |                         |
  |---- GET /users ----------|                         |
  |                         |---- GET /users -------->|
  |                         |                         | (database hangs)
  |                         |                         | ... 30s ...
  |                         |                         | ... 60s ...
  |                         |                         | ... forever ...
  |                         |                         |
  | <-- NO RESPONSE EVER ---|                         |
  | (fd leaked)             | (memory leaked)         |
```

## Real-World Impact

In 2017, a major cloud provider's API gateway experienced a 2-hour outage because a single legacy service had no socket timeout. The gateway accumulated 40,000+ open connections and crashed every node in the cluster.
