# 04 — OLD vs NEW: Patterns That Aged Poorly

Backend JavaScript has evolved dramatically. Here's what we used to do, why we thought it was fine, and why it's wrong in 2025.

---

## 1. Logging: `console.log` vs Pino

### Old Way (2015–2020)

```js
// server.js (CommonJS)
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  console.log(`${req.method} ${req.url}`);
  res.send('Hello');
});

app.listen(3000, () => console.log('Server running'));
```

**Why we did it:**
- `console.log` is built-in. No dependencies.
- It "just works" in development.
- We didn't know about event loop blocking.

**Why it's wrong now:**
- `console.log` is **synchronous**. It calls `process.stdout.write` with blocking I/O under the hood. At 1000+ req/s, the event loop stalls.
- No log levels. Everything is the same importance.
- No structured output. You can't query `statusCode:500` in CloudWatch.
- No redaction. `console.log(req.headers)` leaks auth tokens into logs.

### New Way (2025)

```ts
// src/middleware/logger.ts
import { Logger } from 'pino';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

export function requestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    const startTime = Date.now();

    res.on('finish', () => {
      logger.info({
        requestId,
        method: req.method,
        path: req.url,
        statusCode: res.statusCode,
        durationMs: Date.now() - startTime,
      }, 'request completed');
    });

    next();
  };
}
```

**Why it's better:**
- Asynchronous JSON serialization. No event loop blocking.
- Structured fields are queryable by any log platform.
- Built-in log levels: `trace`, `debug`, `info`, `warn`, `error`, `fatal`.
- Redaction rules prevent credential leaks.

---

## 2. Validation: Manual `if/else` vs Schema Libraries

### Old Way (2015–2020)

```js
app.post('/user', (req, res) => {
  const { name, email, age } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (name.length < 2) {
    return res.status(400).json({ error: 'Name too short' });
  }
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  if (typeof age !== 'number' || age < 18) {
    return res.status(400).json({ error: 'Invalid age' });
  }

  // Finally, the actual business logic
  saveUser({ name, email, age });
});
```

**Why we did it:**
- No dependencies.
- Full control over error messages.

**Why it's wrong now:**
- Verbose. Validation code dwarfs business logic.
- Inconsistent error shapes. Every endpoint invents its own format.
- No TypeScript types. You validate at runtime but get `any` in the editor.
- Easy to forget checks. Human-written validation is incomplete by nature.

### New Way (2025)

See M02 project for full Zod usage. In brief:

```ts
import { z } from 'zod';

const userSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().int().min(18).max(120),
});

type User = z.infer<typeof userSchema>; // TypeScript type derived from schema

app.post('/user', (req, res) => {
  const result = userSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }
  saveUser(result.data); // Fully typed, fully validated
});
```

**Why it's better:**
- One source of truth for runtime validation AND compile-time types.
- Consistent error format across all endpoints.
- Extensible: add `.transform()`, `.refine()`, `.default()` without rewriting logic.

---

## 3. Async Flow: Callbacks vs `async/await`

### Old Way (2015–2018)

```js
function getUser(id, callback) {
  db.query('SELECT * FROM users WHERE id = ?', [id], (err, rows) => {
    if (err) return callback(err);
    if (rows.length === 0) return callback(new Error('Not found'));
    callback(null, rows[0]);
  });
}

// Usage
getUser(1, (err, user) => {
  if (err) { /* handle */ return; }
  getOrders(user.id, (err, orders) => {
    if (err) { /* handle */ return; }
    res.json({ user, orders });
  });
});
```

**Why we did it:**
- It was the only way before Promises were standard.

**Why it's wrong now:**
- Callback hell: nested indentation makes code unreadable.
- Error handling is manual and inconsistent.
- No stack traces across async boundaries.
- Impossible to use `try/catch`.

### New Way (2025)

```ts
async function getUser(id: number): Promise<User> {
  const rows = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  if (rows.length === 0) throw new Error('Not found');
  return rows[0];
}

// Usage
app.get('/user/:id', async (req, res, next) => {
  try {
    const user = await getUser(Number(req.params.id));
    const orders = await getOrders(user.id);
    res.json({ user, orders });
  } catch (err) {
    next(err); // Pass to Express error handler
  }
});
```

**Why it's better:**
- Reads like synchronous code.
- `try/catch` works across async boundaries.
- Stack traces are preserved.
- Easier to refactor and compose.

---

## 4. Module System: CommonJS vs ESM

### Old Way (2009–2022)

```js
// math.js
function add(a, b) { return a + b; }
module.exports = { add };

// app.js
const { add } = require('./math.js');
const express = require('express');
```

**Why we did it:**
- It was the only module system Node.js supported natively for 13 years.
- npm packages were almost all CJS.

**Why it's wrong now:**
- `require()` is synchronous and blocks the module load phase.
- No top-level `await`.
- No static analysis for tree-shaking. Bundlers can't eliminate dead code.
- `__dirname` and `__filename` are globals that don't exist in browsers, making isomorphic code harder.

### New Way (2025)

```ts
// math.ts
export function add(a: number, b: number): number {
  return a + b;
}

// app.ts
import { add } from './math.js';   // Note: .js extension even for .ts source
import express from 'express';

// Top-level await is valid in ESM
const config = await fetch('/config.json').then(r => r.json());
```

**Why it's better:**
- Static imports allow bundlers to analyze the dependency graph and remove unused exports (tree-shaking).
- Top-level `await` simplifies bootstrap code.
- Aligns with browser JavaScript. One module system everywhere.
- Required by modern packages (`node-fetch` v3+, `got` v12+, etc.).

**What about `import` vs `require` for CJS packages?**

Most CJS packages work fine with ESM `import`:

```ts
import express from 'express'; // Works: CJS default export maps to ESM default
```

Some edge cases need `createRequire`:

```ts
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const legacy = require('cjs-only-package');
```

---

## Summary Table

| Pattern | Old (2015–2020) | New (2025) | Why Change |
|---------|-----------------|------------|------------|
| Logging | `console.log` | Pino | Speed, structure, levels |
| Validation | Manual `if/else` | Zod / schema libraries | Type safety, consistency |
| Async | Callbacks | `async/await` | Readability, error handling |
| Modules | CommonJS (`require`) | ESM (`import`) | Tree-shaking, top-level await |
| Tests | Jest + `ts-jest` | Vitest (native ESM/TS) | Zero config, speed |
| Types | `// @ts-ignore` | `.d.ts` declarations | Correctness, autocomplete |

The old patterns aren't "wrong" in isolation. They were the best tools available at the time. But in 2025, continuing to use them is **active technical debt**.
