# Critic Review

## Technical Review

**What a senior engineer would say:**

"This project correctly implements RFC 7807 and demonstrates the two most common Express error handling bugs. However, I have four concerns:

1. **No error IDs.** In production, when a user reports 'I got an error,' you have no way to find it in the logs. Every 5xx error should include a `errorId` field.

2. **404 handler is not RFC 7807 compliant.** It manually constructs the response instead of routing through the error handler. This duplicates logic.

3. **No rate limiting on error responses.** An attacker can flood your error endpoints and generate unlimited error responses. While not a crash risk, it fills logs and consumes bandwidth.

4. **`AppError` does not capture the original error.** If a database error causes an `AppError`, you lose the original stack trace. Consider adding a `cause` field for error chaining."

## Security Review

**Potential vulnerabilities:**

1. **Timing attacks on error responses.** The error handler may take different amounts of time for 400 vs 500 errors. An attacker can use timing to distinguish between "invalid input" and "database is down."

2. **Error message injection.** If `err.message` contains user-controlled input, it could be used for XSS if the client renders it as HTML. Always escape error messages in the client.

3. **Information leakage through `instance`.** The `instance` field reveals the request path. If paths contain sensitive IDs (e.g., `/users/1234/medical-records`), this leaks information.

## Educational Review

**What's missing or confusing:**

- The project does not demonstrate error chaining (e.g., a database error wrapped in an `AppError`). This is a common pattern in real applications.
- There is no discussion of `Error.cause` (ES2022), which allows nested error reporting.
- The 404 handler bypasses the error handler. A better pattern is to throw an `AppError(404)` from the 404 handler and let the error handler format it.

## Fixes Applied

Based on this critique, we would make these changes:

1. Add `errorId` using `crypto.randomUUID()` for every 5xx error.
2. Refactor the 404 handler to throw an `AppError` instead of manually formatting.
3. Add `Error.cause` support to `AppError`.

```typescript
import { randomUUID } from 'crypto';

export class AppError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail: string,
    public type: string = 'about:blank',
    public cause?: Error
  ) {
    super(detail);
    this.name = 'AppError';
  }
}

export function errorHandler(err, req, res, _next) {
  if (res.headersSent) {
    console.error('Error after headers sent:', err);
    return;
  }

  const isAppError = err instanceof AppError;
  const isDev = process.env.NODE_ENV !== 'production';
  const errorId = randomUUID();

  const problem = {
    type: isAppError ? err.type : 'about:blank',
    title: isAppError ? err.title : 'Internal Server Error',
    status: isAppError ? err.status : 500,
    detail: err.message,
    instance: req.originalUrl,
    errorId,
    ...(isDev && { stack: err.stack }),
    ...(isDev && isAppError && err.cause && { cause: err.cause.message }),
  };

  console.error(`[${errorId}]`, err);
  res.status(problem.status).json(problem);
}

// 404 handler
app.use((_req, _res, next) => {
  next(new AppError(404, 'Not Found', 'The requested resource does not exist'));
});
```
