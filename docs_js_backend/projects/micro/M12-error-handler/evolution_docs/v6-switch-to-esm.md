# v6-switch-to-esm.md — Error Handler

## The Pain

CommonJS error handling had a subtle issue with custom error classes:

```javascript
// errors.js (CommonJS)
class AppError extends Error {
  constructor(status, title, detail, type = 'about:blank') {
    super(detail);
    this.status = status;
    this.title = title;
    this.type = type;
  }
}
module.exports = { AppError };
```

```javascript
// middleware/errorHandler.js (CommonJS)
const { AppError } = require('../errors');

function errorHandler(err, req, res, next) {
  const isAppError = err instanceof AppError;
  // ...
}
```

This broke when we had **duplicate instances** of the module (e.g., from symlinks in monorepos or npm link):

```javascript
// Symlink causes two copies of errors.js to be loaded
const { AppError } = require('../errors');          // copy A
const { AppError: AppError2 } = require('../../errors');  // copy B (same file, different path)

const err = new AppError(400, 'Bad', 'Oops');
console.log(err instanceof AppError);   // true
console.log(err instanceof AppError2);  // false!  Different prototype chain
```

In monorepos, `instanceof` checks fail unpredictably. The error handler treats `AppError` as a generic `Error`, losing the custom status code and title.

## The Fix: Switch to ESM

ESM has **singleton semantics** — a module is evaluated once and cached by its canonical URL:

```typescript
// src/errors.ts (ESM)
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
// src/middleware/errorHandler.ts (ESM)
import { AppError } from '../errors.js';

export function errorHandler(err, req, res, next) {
  const isAppError = err instanceof AppError;  // reliable in ESM
  // ...
}
```

ESM guarantees that `import { AppError } from '../errors.js'` always returns the same class reference, regardless of symlinks or monorepo structure.

## But ESM Has Gotchas

1. **No `instanceof` across realms:** If errors cross iframe/worker boundaries, `instanceof` still fails. Use `err.name === 'AppError'` as a fallback.
2. **Error cause:** ESM natively supports the `cause` option in `new Error('msg', { cause: err })`.

## Why This Matters for Error Handlers

Error handlers rely on `instanceof` to branch logic. If `instanceof` is unreliable, you get 500s for known 400s, or you leak stack traces because the handler thinks everything is an unknown error.

> **Lesson:** ESM's singleton module cache makes `instanceof` reliable. In CJS monorepos, prefer `err.name` checks or `Symbol.for` branding.
