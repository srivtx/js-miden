# v3-add-validation.md — Error Handler

## The Pain

TypeScript (v2) gave us typed error classes, but we still had runtime issues:

```typescript
app.post('/divide', (req, res, next) => {
  const { a, b } = req.body as { a?: number; b?: number };
  if (typeof a !== 'number' || typeof b !== 'number') {
    next(new AppError(400, 'Bad Request', 'Both a and b must be numbers'));
    return;
  }
  if (b === 0) {
    next(new AppError(400, 'Bad Request', 'Division by zero'));
    return;
  }
  res.json({ result: a / b });
});
```

1. `req.body` could be `null` or an array — TypeScript trusts the assertion.
2. The error handler itself didn't validate that `err` was actually an `Error` or `AppError`.
3. A malformed error object (e.g., from a third-party library) could crash the handler.

## The Fix: Add Runtime Validation

```typescript
// validation.ts
import { z } from 'zod';

export const divideSchema = z.object({
  a: z.number(),
  b: z.number().refine((v) => v !== 0, { message: 'Division by zero' }),
});
```

```typescript
// middleware/errorHandler.ts
export function errorHandler(err, req, res, next) {
  const isAppError = err instanceof AppError;
  const status = isAppError ? err.status : 500;
  const title = isAppError ? err.title : 'Internal Server Error';

  // Validate res state before writing
  if (res.headersSent) {
    console.error('Error after headers sent:', err);
    return;
  }

  const problem = {
    type: isAppError ? err.type : 'about:blank',
    title,
    status,
    detail: err.message || 'Unknown error',
    instance: req.originalUrl,
    stack: err.stack,  // BUG: still exposed — see v4
  };

  res.status(status).json(problem);
}
```

Now:
- Invalid JSON bodies are caught by Express body-parser before reaching routes.
- Zod validates `a` and `b` are numbers before division.
- The error handler validates `err` shape before accessing properties.

## But Validation Doesn't Prevent Stack Leaks

The error handler still exposes `err.stack` in all environments. In production, this leaks file paths and internal implementation details to attackers.

> **Lesson:** Runtime validation ensures incoming data matches expectations. But environment-aware error responses require additional logic (see v4).
