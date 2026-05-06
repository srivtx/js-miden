# Concepts Explained

## Concept: Logging Patterns

### What Is It?
A logging pattern is a structured approach to recording application events. In web APIs, this means recording every HTTP request with metadata like method, path, status code, duration, and user agent.

### Why Do We Use It?
Without logs, debugging production issues is impossible. When a user reports "it doesn't work," logs are the only way to see what actually happened. Metrics (e.g., "99th percentile latency is 200ms") tell you THAT something is wrong. Logs tell you WHAT is wrong.

### How Does It Work?

```
┌─────────────────────────────────────────────────────────────┐
│  Request arrives                                            │
│     │                                                       │
│     ▼                                                       │
│  Middleware starts timer (Date.now())                       │
│     │                                                       │
│     ▼                                                       │
│  Route handler runs                                         │
│     │                                                       │
│     ▼                                                       │
│  Response is sent (res.json(), res.send(), etc.)            │
│     │                                                       │
│     ▼                                                       │
│  res.on('finish') fires                                     │
│     │                                                       │
│     ▼                                                       │
│  Logger calculates duration = now - start                   │
│  Logger redacts sensitive fields                            │
│  Logger writes structured JSON to stdout                    │
└─────────────────────────────────────────────────────────────┘
```

### Code Example
```typescript
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(JSON.stringify({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
    }));
  });

  next();
}
```

### Common Misconceptions
- **Wrong way:** "I'll log synchronously inside the route handler."
  - **Right way:** Logging inside the route blocks the response. Use `res.on('finish')` to log after the response is sent.
- **Wrong way:** "I'll log the entire req and res objects."
  - **Right way:** `req` and `res` are huge objects with circular references. JSON.stringify will fail or produce megabytes of output.

### Related Concepts
- Structured logging
- Log levels (debug, info, warn, error)
- Log aggregation

---

## Concept: Sync vs Async Logging

### What Is It?
Synchronous logging blocks the event loop until the log line is written. Asynchronous logging buffers the log line and writes it later, allowing the event loop to continue immediately.

### Why Do We Use It?
Node.js is single-threaded. If the event loop is blocked, no other requests can be processed. Under high load, synchronous logging becomes a bottleneck.

### How Does It Work?

```
Synchronous (console.log):
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Request 1   │────▶│ console.log │────▶│ Request 2   │
│ arrives     │     │ blocks here │     │ waits       │
└─────────────┘     └─────────────┘     └─────────────┘

Asynchronous (pino with sync: false):
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Request 1   │────▶│ Buffer log  │────▶│ Request 2   │
│ arrives     │     │ (non-blocking)│    │ runs        │
│             │     │             │     │ immediately │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │
       │                    ▼
       │            ┌─────────────┐
       │            │ Worker      │
       │            │ flushes     │
       │            │ buffer      │
       │            │ periodically│
       │            └─────────────┘
       │
       ▼
┌─────────────┐
│ Response    │
│ sent        │
└─────────────┘
```

### Code Example
```typescript
// Synchronous (default console.log)
console.log(JSON.stringify({ method: 'GET', path: '/health' }));

// Asynchronous (pino)
import pino from 'pino';
const logger = pino({ level: 'info' }, pino.destination({ sync: false }));
logger.info({ method: 'GET', path: '/health' });
```

### Common Misconceptions
- **Wrong way:** "console.log is async because Node.js is async."
  - **Right way:** `console.log` is synchronous. It calls `process.stdout.writeSync` under the hood when stdout is a TTY.
- **Wrong way:** "Async logging might lose logs, so I should always use sync."
  - **Right way:** The risk of losing a few logs is usually smaller than the risk of blocking the event loop and dropping requests. For critical logs (e.g., financial transactions), use a hybrid approach: sync for critical, async for routine.

### Related Concepts
- Node.js event loop
- `process.stdout`
- Worker threads

---

## Concept: Sensitive Data Redaction

### What Is It?
Sensitive data redaction is the process of removing or replacing sensitive fields (passwords, tokens, PII) before they are written to logs.

### Why Do We Use It?
Logs are often less secure than databases. They may be:
- Stored in plaintext on disk.
- Shipped to third-party services (Datadog, Splunk).
- Accessible to support staff and SREs.
- Retained for months or years.

A single unredacted password in a log file can compromise an account permanently.

### How Does It Work?

```
Original request body:
{
  "username": "admin",
  "password": "SuperSecret123!",
  "creditCard": "4111111111111111",
  "preferences": { "theme": "dark" }
}

After redaction:
{
  "username": "admin",
  "password": "[REDACTED]",
  "creditCard": "[REDACTED]",
  "preferences": { "theme": "dark" }
}
```

### Code Example
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

console.log(JSON.stringify({
  method: req.method,
  path: req.path,
  body: redact(req.body),
}));
```

### Common Misconceptions
- **Wrong way:** "My logs are internal, so I don't need to redact."
  - **Right way:** "Internal" includes CI/CD pipelines, log aggregators, support tickets, and sometimes third-party contractors. Redaction is a defense-in-depth measure.
- **Wrong way:** "I'll just redact the top-level fields."
  - **Right way:** Sensitive data can be nested: `{ user: { password: "..." } }`. Redaction must be recursive.

### Related Concepts
- GDPR Article 32
- OWASP Logging Cheat Sheet
- Data Loss Prevention (DLP)

---

## Concept: Log Rotation

### What Is It?
Log rotation is the process of archiving or deleting old log files to prevent disk space exhaustion. It can be time-based (daily, hourly) or size-based (every 100MB).

### Why Do We Use It?
A single misbehaving client or a log-level debug storm can generate gigabytes of logs in minutes. Without rotation, the disk fills up, and the application crashes.

### How Does It Work?

```
Day 1:        Day 2:        Day 3:        Day 4:
app.log       app.log       app.log       app.log
              app-1.log     app-1.log     app-1.log
                            app-2.log     app-2.log
                                          app-3.log
                                          (app-1.log deleted)
```

### Code Example
```bash
# logrotate configuration
/var/log/myapp/*.log {
  daily
  rotate 7
  compress
  delaycompress
  missingok
  notifempty
  create 0640 app app
}
```

### Common Misconceptions
- **Wrong way:** "I'll just delete old logs manually."
  - **Right way:** Manual deletion is forgotten during incidents. Automated rotation is the only reliable approach.
- **Wrong way:** "I'll keep logs forever for compliance."
  - **Right way:** Compliance requirements specify retention periods (e.g., 90 days). Keeping logs forever increases breach impact and storage costs.

### Related Concepts
- Disk space monitoring
- Log retention policies
- GDPR right to erasure
