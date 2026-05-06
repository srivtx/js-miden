# Critic Review

## Technical Review

**What a senior engineer would say:**

"This project correctly identifies the two most dangerous logging anti-patterns: unredacted bodies and synchronous logging. However, I have four concerns:

1. **No log levels.** Every log is treated as `info`. In production, you need `debug`, `info`, `warn`, and `error` levels to filter noise.

2. **No request IDs.** Without a `requestId`, you cannot correlate logs across microservices. A single user action might touch 5 services. Without IDs, you are debugging in the dark.

3. **No log sampling.** At 10,000 req/s, logging every request generates 864M log lines per day. Most of them are identical `/health` checks. Sampling (e.g., log 1% of 200s, 100% of 500s) reduces cost by 99%.

4. **Redaction is case-sensitive in a weird way.** `SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f))` checks if the key CONTAINS the sensitive word. This means `apiKey` matches, but `ApiKey` does not match `apikey`. It should be: `key.toLowerCase().includes(f.toLowerCase())` or use a Set with normalized keys."

## Security Review

**Potential vulnerabilities:**

1. **Query string leakage.** The logger logs `req.path` but not `req.query`. However, if `req.path` includes query parameters (e.g., `/search?q=secret`), they are logged. Consider logging `req.path` without query strings and redacting `req.query`.

2. **Header leakage.** The logger only logs `user-agent`. Other headers like `Authorization` or `Cookie` are not logged, which is good. But if you extend the logger to log all headers, you must redact them.

3. **Log injection.** If `req.path` contains newlines or control characters, it could corrupt the log format. JSON.stringify handles this, but plain text loggers are vulnerable.

## Educational Review

**What's missing or confusing:**

- The project does not demonstrate log rotation. A real system would use `pino-roll` or `logrotate`.
- There is no discussion of log retention policies. GDPR requires deletion of personal data after a certain period.
- The project does not show how to correlate logs with distributed traces.

## Fixes Applied

Based on this critique, we would make these changes:

1. Add log levels using `pino`.
2. Generate a `requestId` for every request and include it in all logs.
3. Implement sampling: log 100% of errors, 1% of successes.
4. Fix redaction to use case-insensitive matching.

```typescript
import { randomUUID } from 'crypto';
import pino from 'pino';

const logger = pino({ level: 'info' });

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = randomUUID();
  req.headers['x-request-id'] = requestId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const isError = res.statusCode >= 500;
    const shouldLog = isError || Math.random() < 0.01; // 100% errors, 1% successes

    if (!shouldLog) return;

    logger.info({
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      body: redact(req.body),
    });
  });

  next();
}
```
