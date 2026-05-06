# v2-add-typescript.md — Error Handler

## The Pain

In v1 (pure JS), errors were handled inconsistently. Some routes returned plain JSON, others crashed:

```javascript
app.post('/divide', (req, res) => {
  const { a, b } = req.body;
  if (typeof a !== 'number') {
    return res.status(400).json({ msg: 'bad input' });  // { msg } — inconsistent key
  }
  res.json({ result: a / b });
});

app.get('/async-error', async (req, res) => {
  await Promise.reject(new Error('boom'));  // crashes process
});
```

1. Error responses had different shapes (`{ msg }`, `{ error }`, `{ message }`) — clients couldn't parse them reliably.
2. Async errors crashed the process because there was no catch.

## The Fix: Add TypeScript + Custom Error Class

```typescript
// errors.ts
export class AppError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail: string,
    public type: string = 'about:blank'
  ) {
    super(detail);
    this.name = 'AppError';
  }
}
```

```typescript
// routes.ts
import { AppError } from './errors.js';

app.post('/divide', (req, res, next) => {
  const { a, b } = req.body as { a?: number; b?: number };
  if (typeof a !== 'number' || typeof b !== 'number') {
    return next(new AppError(400, 'Bad Request', 'Both a and b must be numbers'));
  }
  res.json({ result: a / b });
});
```

TypeScript ensures every error route calls `next()` with an `Error` or `AppError`. It also catches typos:
```typescript
next(new AppError(400, 'Bad Request', 'Oops'));
// Typo in property names is caught at compile time
```

## But TypeScript Doesn't Catch Everything

TypeScript can't prevent you from calling `res.json()` twice in the same route. And it doesn't know whether `res.headersSent` is true — that's a runtime state.

> **Lesson:** TypeScript enforces consistent error shapes and catches handler signature mismatches. But runtime state (headers already sent) still requires defensive code.
