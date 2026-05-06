# WRONG vs RIGHT: API Gateway Basics

## The Bug: No Request Timeout

### Wrong (Current Code)

```typescript
// src/gateway.ts
function proxyRequest(req, res, target) {
  const options = {
    hostname: target.hostname,
    port: target.port,
    path: req.path,
    method: req.method,
    headers: req.headers,
    // NO timeout set!
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode);
    proxyRes.pipe(res);
  });

  // If the backend hangs, this request stays open forever
  req.pipe(proxyReq);
}
```

**Why It's Wrong:**
- A slow or dead backend causes the gateway to hang indefinitely.
- File descriptors and memory are leaked.
- Clients experience infinite waits instead of a clear error.

### Right (Fixed Code)

```typescript
// src/gateway.ts
function proxyRequest(req, res, target) {
  const options = {
    hostname: target.hostname,
    port: target.port,
    path: req.path,
    method: req.method,
    headers: req.headers,
    timeout: 5000, // 5 second timeout
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode);
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
}
```

**Why It's Right:**
- Requests that exceed 5 seconds are terminated.
- The client receives a clear `504 Gateway Timeout`.
- Errors are handled gracefully with `502 Bad Gateway`.

## Key Takeaway

Every outbound network call in a gateway must have a timeout. Without it, a single failing backend can cascade into a gateway outage.
