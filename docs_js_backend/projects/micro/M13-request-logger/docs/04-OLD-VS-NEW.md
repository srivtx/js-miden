# Old Ways vs New Ways (2025)

## Pattern: Logging Implementation

### The Old Way (2015-2020)
```javascript
// app.js
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});
```
**Why we did it:** It was simple and human-readable. Most tutorials taught this pattern.

**Why it is wrong now:**
1. Plain text is impossible to query at scale. Try finding all 500 errors in 1GB of plain text logs.
2. No status code or duration. You can't calculate latency percentiles.
3. No redaction. Passwords leak into logs.
4. `console.log` is synchronous and blocks the event loop under load.

### The New Way (2025)
```typescript
// middleware/logger.ts
res.on('finish', () => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    method: req.method,
    path: req.path,
    status: res.statusCode,
    duration: Date.now() - start,
    userAgent: req.headers['user-agent'],
    body: redact(req.body),
  }));
});
```
**Why it is better:**
1. Structured JSON is queryable. `jq '.status == 500'` or `Datadog: status:500`.
2. Duration tracking enables latency monitoring.
3. Redaction prevents credential leaks.
4. `res.on('finish')` ensures the status code is known and does not block the response.

**When to still use old way:** Local development debugging where you just want to see requests fly by. Even then, structured logging is better.

### Migration Path
1. Replace `console.log(string)` with `console.log(JSON.stringify(object))`.
2. Add `res.on('finish')` to capture status codes.
3. Implement `redact()` for sensitive fields.
4. Switch to `pino` for production.

---

## Pattern: Log Transport

### The Old Way (2015-2020)
```javascript
// Write to file manually
const fs = require('fs');
const stream = fs.createWriteStream('app.log', { flags: 'a' });
app.use((req, res, next) => {
  stream.write(`${req.method} ${req.path}\n`);
  next();
});
```
**Why we did it:** Files were the standard way to persist logs.

**Why it is wrong now:**
1. File descriptors can leak if not managed.
2. No automatic rotation. Disk fills up.
3. In containers, files are ephemeral. Logs are lost on restart.
4. Hard to aggregate across multiple instances.

### The New Way (2025)
```typescript
// Write structured JSON to stdout
console.log(JSON.stringify({ ... }));

// Let the platform handle aggregation
// Docker: docker logs
// Kubernetes: kubectl logs -> Fluentd/Fluent Bit -> Elasticsearch
// AWS ECS: CloudWatch Logs
```
**Why it is better:**
1. Stdout is the 12-Factor App standard.
2. Container platforms automatically capture stdout.
3. No file descriptor management.
4. Centralized aggregation is handled by the infrastructure.

**When to still use old way:** VM-based deployments where stdout is not captured. In that case, use `pino` with `pino-roll` for file rotation.

### Migration Path
1. Remove file writes.
2. Write JSON to stdout.
3. Configure your container orchestrator to ship stdout to your log aggregator.

---

## Pattern: Sensitive Data Handling

### The Old Way (2015-2020)
```javascript
app.use((req, res, next) => {
  console.log('Body:', req.body); // Logs everything, including passwords
  next();
});
```
**Why we did it:** Developers assumed logs were "internal only" and never considered the security implications.

**Why it is wrong now:**
1. GDPR, CCPA, and SOC 2 explicitly require protection of personal data in logs.
2. Logs are often shipped to third parties with different security postures.
3. Support staff and contractors may have access to logs.
4. A single credential leak can compromise an entire system.

### The New Way (2025)
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
```
**Why it is better:**
1. Explicit redaction of known sensitive fields.
2. Recursive, so nested objects are also scrubbed.
3. Easy to extend with new fields.
4. Zero risk of accidentally logging passwords.

**When to still use old way:** Never in production. Only in controlled local development with synthetic data.

### Migration Path
1. Identify all places where `req.body` is logged.
2. Wrap them with `redact()`.
3. Add tests that assert sensitive fields are not present in logs.
4. Audit existing log files for leaked credentials.
