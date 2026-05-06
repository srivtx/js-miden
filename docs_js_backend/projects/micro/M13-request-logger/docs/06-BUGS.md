# The Bugs

## Bug 1: Sensitive Data Leakage in Logs

### How to Introduce It
```typescript
res.on('finish', () => {
  console.log(
    JSON.stringify({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      body: req.body,  // <-- Logs EVERYTHING, including passwords
    })
  );
});
```

### Why It Exists
The developer wanted a complete request trace for debugging. They did not consider that `req.body` might contain sensitive data. The thinking error was: "Logs are internal, so it's fine."

### Symptoms You'll See
- Log files contain plaintext passwords: `{"username":"admin","password":"secret"}`.
- Log aggregators (Datadog, Splunk) index the passwords, making them searchable.
- Support staff can search logs and find user credentials.
- SOC 2 auditors flag this as a critical finding.

### How to Reproduce
1. Start the server.
2. `curl -X POST http://localhost:3000/login -H "Content-Type: application/json" -d '{"username":"admin","password":"secret"}'`
3. Check the server logs. The password appears in plaintext.

### The Fix
```typescript
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'authorization', 'apiKey'];

function redact(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);

  const clone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    clone[key] = SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f))
      ? '[REDACTED]'
      : redact(value);
  }
  return clone;
}

// In the logger:
body: redact(req.body),
```

### Why the Fix Works
The `redact()` function recursively traverses objects. Any key matching the sensitive list is replaced with `[REDACTED]`. This prevents credentials from ever entering the log stream.

### Real-World Impact
In 2022, a major fintech company discovered that their request logs contained unredacted credit card numbers. The logs were shipped to a third-party analytics service. An employee of the analytics company found the data during a routine query and reported it. The fintech faced regulatory fines, a 6-month audit, and permanent reputational damage. The root cause was a single line: `logger.info({ body: req.body })`.

---

## Bug 2: Synchronous Logging Bottleneck

### How to Introduce It
Using `console.log` without understanding that it blocks the event loop:
```typescript
res.on('finish', () => {
  console.log(JSON.stringify({ ... }));  // Synchronous write
});
```

### Why It Exists
Developers assume `console.log` is "fast enough." Under low load, it is. Under high load (10,000+ req/s), synchronous I/O to stdout becomes a bottleneck.

### Symptoms You'll See
- Throughput drops under load. Latency spikes.
- CPU usage is low but requests queue up.
- `node --prof` shows significant time in `write` syscalls.
- Container health checks fail because the event loop is blocked.

### How to Reproduce
1. Start the server.
2. Run a load test: `autocannon -c 100 -d 30 http://localhost:3000/health`
3. Observe that throughput plateaus while latency increases.
4. Switch to async logging and rerun. Throughput improves significantly.

### The Fix
```typescript
import pino from 'pino';
const logger = pino({ level: 'info' }, pino.destination({ sync: false }));

res.on('finish', () => {
  logger.info({ ... });  // Asynchronous write
});
```

### Why the Fix Works
`pino.destination({ sync: false })` buffers log lines and flushes them asynchronously. The event loop is never blocked by I/O. Benchmarks show 5-10x throughput improvement over `console.log` under load.

### Real-World Impact
In 2021, a high-traffic social media API experienced random latency spikes during peak hours. After weeks of debugging, they discovered that `console.log` was blocking the event loop. Switching to `pino` with `sync: false` reduced p99 latency from 500ms to 50ms. The issue had cost them an estimated $500K in lost ad revenue due to user churn.
