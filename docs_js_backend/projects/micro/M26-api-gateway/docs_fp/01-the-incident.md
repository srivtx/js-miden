# The 3AM Page: The Gateway Timeout

It's 3:00 AM. All services are down.

**Monitoring:** "Gateway timeout. All requests hanging."

You check the gateway:
```javascript
app.use('/api', createProxyMiddleware({
  target: 'http://backend:3000',
  changeOrigin: true
}));
```

**No timeout configured.** When the backend is slow, requests hang forever.

At 1000 req/s with 30s hangs:
- 30,000 concurrent requests
- Memory exhausted
- Event loop blocked
- Everything dies

---

## Your Turn

### Q1: Why is no timeout worse than a fast failure?

A timeout is an error. Why not let it retry?

<br><br><br><br><br>

---

## The Autopsy

### Answer: Hanging requests consume resources

Each hanging request:
- Holds an HTTP connection
- Uses memory
- Blocks a thread (or async resource)
- Prevents new requests from being handled

**A gateway without timeout is a resource leak.**

### The Fix

```javascript
app.use('/api', createProxyMiddleware({
  target: 'http://backend:3000',
  changeOrigin: true,
  proxyTimeout: 5000,  // 5s timeout
  timeout: 5000
}));
```

**Fail fast. Return 504 Gateway Timeout.**
