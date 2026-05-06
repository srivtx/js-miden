# v3-add-validation.md — Request Logger

## The Pain

TypeScript (v2) gave us a consistent `LogEntry` shape, but we were still logging raw request bodies:

```typescript
interface LogEntry {
  method: string;
  path: string;
  status: number;
  duration: number;
  userAgent: string | undefined;
  body: unknown;  // <-- raw user input
}

res.on('finish', () => {
  const entry: LogEntry = {
    // ...
    body: req.body,  // contains passwords, tokens, PII
  };
  console.log(JSON.stringify(entry));
});
```

1. A login request logs: `{ username: 'admin', password: 'secret' }`
2. A payment request logs: `{ cardNumber: '4111111111111111', cvv: '123' }`
3. These logs are shipped to external systems (CloudWatch, Datadog) where they may be retained for years.

## The Fix: Add Runtime Redaction

```typescript
// redaction.ts
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'authorization', 'apiKey', 'cardNumber', 'cvv'];

export function redact(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);

  const clone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    clone[key] = SENSITIVE_FIELDS.some((f) => key.toLowerCase().includes(f))
      ? '[REDACTED]'
      : redact(value);
  }
  return clone;
}
```

```typescript
// logger.ts
import { redact } from './redaction.js';

res.on('finish', () => {
  const entry: LogEntry = {
    method: req.method,
    path: req.path,
    status: res.statusCode,
    duration: Date.now() - start,
    userAgent: req.headers['user-agent'],
    body: redact(req.body),
  };
  console.log(JSON.stringify(entry));
});
```

Now a login request logs:
```json
{
  "method": "POST",
  "path": "/login",
  "status": 200,
  "duration": 12,
  "userAgent": "Mozilla/5.0",
  "body": { "username": "admin", "password": "[REDACTED]" }
}
```

## But Redaction Doesn't Fix Performance

`console.log` writes to stdout **synchronously**. Under high load, every request blocks the event loop for I/O. And `JSON.stringify` on large bodies is CPU-intensive.

> **Lesson:** Redaction prevents data leaks. But production logging also needs async I/O and performance tuning.
