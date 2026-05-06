# M12: Error Handler

An Express API that returns RFC 7807 Problem Details for various error scenarios.

## Endpoints

- `POST /divide` - Divide two numbers (returns 400 for invalid input or division by zero)
- `GET /async-error` - Triggers an async error (returns 500)
- `GET /headers-sent` - Sends a response then triggers an error

## Quick Start

```bash
npm install
npm run dev      # development server on :3000
npm test         # run tests
```

## Phase 1: Basic Implementation

The API returns RFC 7807 `application/problem+json` responses for all errors:

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Both a and b must be numbers",
  "instance": "/divide"
}
```

A global error handler catches synchronous, async, and application-level errors.

## Phase 2-3: Design Thinking

### 1. Error Response Format

**Decision needed:** What format should errors use?

- **Plain JSON `{ error: "..." }`:** Simple but inconsistent across clients.
- **RFC 7807 Problem Details:** Standardized fields (`type`, `title`, `status`, `detail`, `instance`).
  - Pros: Predictable, machine-readable, well-documented standard.
  - Cons: Slightly more verbose.

**Conclusion:** Use RFC 7807 for all 4xx/5xx responses. It provides a contract that API consumers can rely on.

### 2. Stack Trace Exposure

**Decision needed:** Should stack traces be included in error responses?

- **Always include (current, BUGGY):** Helps developers debug.
  - Cons: **Major security risk in production.** Leaks file paths, dependencies, and internal logic to attackers.
- **Never include:** Safe but hard to debug production issues.
- **Include only in development/test:** Best of both worlds.

**Conclusion:** Strip `stack` from the response body when `NODE_ENV === 'production'`. Log it internally instead.

### 3. Async Error Handling

**Decision needed:** How do we handle errors in async route handlers?

- **Manual try/catch + next(err):** Explicit but repetitive.
- **Express 5 default:** Express 5 automatically forwards rejected promises to the error handler.
- **Wrapper function:** Wraps async handlers to catch rejects.

**Conclusion:** Express 5 handles this natively. Ensure all async routes either `await` and `next(err)` in catch blocks, or let Express 5 catch unhandled rejections.

### 4. Double-Response Protection (`res.headersSent`)

**Decision needed:** What happens if an error occurs after the response has already started?

- **Ignore it (current, BUGGY):** The error handler calls `res.status(...).json(...)` unconditionally. If headers were already sent, Node.js throws `ERR_HTTP_HEADERS_SENT` and **crashes the process**.
- **Check `res.headersSent`:** If true, delegate to the default handler or log and abort.
- **Use a library:** Some frameworks handle this automatically.

**Conclusion:** Every custom error handler must check `res.headersSent`. If true, log the error and do not attempt to write to the response.

### 5. Error IDs for Tracking

Production errors should include a unique `errorId` (UUID or nanoid) so support teams can correlate user reports with logs.

**Conclusion:** Generate an `errorId` for every 5xx error. Return it in the response and include it in all log lines.

## Known Bug

The global error handler has **two related issues**:

1. **Exposes stack traces:** The handler always includes `err.stack` in the JSON response, even in production.
2. **Missing `res.headersSent` check:** If an error occurs after the response has already been sent (e.g., in a stream or post-response cleanup), the handler tries to send a second response, crashing the process with `ERR_HTTP_HEADERS_SENT`.

### How to fix

```typescript
export function errorHandler(err, req, res, next) {
  // Prevent double-response crashes
  if (res.headersSent) {
    console.error('Error after headers sent:', err);
    return;
  }

  const isAppError = err instanceof AppError;
  const isDev = process.env.NODE_ENV !== 'production';

  const problem = {
    type: isAppError ? err.type : 'about:blank',
    title: isAppError ? err.title : 'Internal Server Error',
    status: isAppError ? err.status : 500,
    detail: err.message,
    instance: req.originalUrl,
    // Only include stack in non-production environments
    ...(isDev && { stack: err.stack }),
  };

  res.status(problem.status).json(problem);
}
```

For robust production tracking, add an `errorId`:

```typescript
import { randomUUID } from 'crypto';

const errorId = randomUUID();
console.error(`[${errorId}]`, err);
problem.errorId = errorId;
```
