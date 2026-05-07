# M13 Request Logger: Three Wrongs

Below are three plausible but broken implementations of request logging. Each looks reasonable on the surface. Each will fail in production.

---

## Wrong #1: Synchronous Logging with Raw Body

```typescript
app.use((req, res, next) => {
  console.log(JSON.stringify({
    method: req.method,
    path: req.path,
    body: req.body,
  }));
  next();
});
```

### Why It Looks Right
It is simple. It logs before the route runs. It captures the request body for debugging.

### Why It Destroys You
1. **Synchronous**: `console.log` blocks the event loop. At 1,000 req/s, throughput collapses.
2. **No status code**: The response has not been sent yet. You never know if the request succeeded.
3. **Credential leak**: `req.body` contains plaintext passwords. They are now in your logs, your log aggregator, and every engineer's Splunk queries.

**The failure mode**: Under load, latency spikes to seconds. Health checks time out. The orchestrator kills the pod. Meanwhile, a GDPR fine arrives because user passwords are indexed in plaintext.

---

## Wrong #2: Fire-and-Forget Async with No Redaction

```typescript
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    fs.appendFile('access.log', JSON.stringify({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      body: req.body,
    }) + '\n', () => {});
  });
  next();
});
```

### Why It Looks Right
It is non-blocking. It captures the status code. It uses the standard Node.js callback pattern.

### Why It Destroys You
`fs.appendFile` opens, writes, and closes the file on every request. At high concurrency, the kernel file descriptor table explodes. Worse, `req.body` is still logged raw — every password, token, and credit card number is now on disk in plaintext. The async write only fixes the blocking problem. It does not fix the security problem.

**The failure mode**: Memory usage grows linearly with traffic as libuv queues write requests. The pod is OOM-killed. The log file is a toxic waste dump of credentials.

---

## Wrong #3: Logging the Entire req Object

```typescript
app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(JSON.stringify({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      request: req,   // <-- Logging the entire req object
    }));
  });
  next();
});
```

### Why It Looks Right
The `req` object has everything: headers, query, body, IP. Why not log it all for complete observability?

### Why It Destroys You
1. **Circular references**: `req` contains `req.res`, which contains `res.req`. `JSON.stringify` throws or produces megabytes of output.
2. **Massive log bloat**: A single `req` object serialized is 50-200 KB. At 1,000 req/s, that is 200 MB/s of log volume.
3. **Header leakage**: `req.headers.authorization`, `req.headers.cookie`, and `req.headers['x-api-key']` are all logged in plaintext.

**The failure mode**: Log volume grows at 10 GB/hour. The disk fills in 4 hours. The log aggregator bills $50,000 for the month. Security finds API keys in Splunk.

---

## The Pattern

| Wrong | Surface Appeal | Hidden Failure |
|-------|---------------|----------------|
| Sync + raw body | Simple, complete trace | Event loop blocking, credential leak, no status code |
| Async + raw body | Non-blocking, captures status | FD exhaustion, still leaks credentials |
| Entire req object | Complete observability | Circular refs, massive bloat, header leakage |

The correct solution requires combining the best of all three: async writes, a single stream or queue for efficiency, explicit field selection, and recursive redaction of sensitive data.
