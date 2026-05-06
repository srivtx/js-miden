# 04 — OLD vs NEW: Patterns That Aged Poorly

Backend JavaScript validation has evolved from manual chaos to schema-driven safety. Here's the journey.

---

## 1. Validation: Manual `if/else` vs Zod

### Old Way (2015–2020)

```js
// validation.js (CommonJS)
function validateUser(body) {
  const errors = [];

  if (!body.name) {
    errors.push({ field: 'name', message: 'Name is required' });
  } else if (typeof body.name !== 'string') {
    errors.push({ field: 'name', message: 'Name must be a string' });
  } else if (body.name.length < 2) {
    errors.push({ field: 'name', message: 'Name too short' });
  } else if (body.name.length > 50) {
    errors.push({ field: 'name', message: 'Name too long' });
  }

  if (!body.email) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (typeof body.email !== 'string') {
    errors.push({ field: 'email', message: 'Email must be a string' });
  } else if (!body.email.includes('@')) {
    errors.push({ field: 'email', message: 'Invalid email' });
  }

  if (typeof body.age !== 'number') {
    errors.push({ field: 'age', message: 'Age must be a number' });
  } else if (body.age < 18) {
    errors.push({ field: 'age', message: 'Too young' });
  } else if (body.age > 120) {
    errors.push({ field: 'age', message: 'Too old' });
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true, data: body };
}

module.exports = { validateUser };
```

**Why we did it:**
- No dependencies. Pure JavaScript.
- Full control over error messages.
- We didn't know about schema libraries.

**Why it's wrong now:**
- **Massive boilerplate.** 40 lines of validation for 3 fields. Real schemas have 20+ fields.
- **No type safety.** The returned `data` is still `any`. No IntelliSense.
- **Inconsistent.** Every developer writes validation differently. One uses `"field"`, another uses `"path"`. One returns strings, another returns objects.
- **Brittle.** Add a new field? Write 10 more lines of `if/else`. Miss one check? Production crash.
- **No composition.** You can't reuse the email validation logic for `billingEmail` and `shippingEmail` without copy-paste.

### New Way (2025)

```ts
// src/validation.ts
import { z } from 'zod';

export const userSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().int().min(18).max(120),
});

export type User = z.infer<typeof userSchema>;
```

```ts
// src/app.ts
import { userSchema } from './validation.js';

app.post('/validate', (req, res) => {
  const result = userSchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    return res.status(400).json({ valid: false, errors });
  }

  res.status(200).json({ valid: true, data: result.data });
});
```

**Why it's better:**
- **Single source of truth.** One schema gives runtime validation AND compile-time types.
- **Composable.** `z.string().email()` can be extracted to `const emailSchema` and reused.
- **Extensible.** Add `.transform()`, `.refine()`, `.default()` without rewriting logic.
- **Consistent.** Every endpoint uses the same validation pattern.
- **Type safe.** `result.data` is fully typed. Autocomplete works. Refactoring is safe.

---

## 2. Logging: `console.log` vs Pino

See M01's `04-OLD-VS-NEW.md` for full detail. In brief:

```js
// OLD
console.log(`Validation failed: ${JSON.stringify(errors)}`);

// NEW
logger.info({ errors, requestId }, 'validation failed');
```

---

## 3. Async Flow: Callbacks vs `async/await`

See M01's `04-OLD-VS-NEW.md` for full detail. In brief:

```js
// OLD
validateUser(body, (err, result) => {
  if (err) { /* ... */ return; }
  saveUser(result.data, (err) => {
    if (err) { /* ... */ return; }
    res.json({ ok: true });
  });
});

// NEW
const result = userSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ errors: result.error.errors });
}
await saveUser(result.data);
res.json({ ok: true });
```

---

## 4. Module System: CommonJS vs ESM

See M01's `04-OLD-VS-NEW.md` for full detail. In brief:

```js
// OLD
const { validateUser } = require('./validation.js');

// NEW
import { userSchema } from './validation.js';
```

---

## 5. Type Safety: `any` vs Strict Types

### Old Way (2015–2020)

```js
// No types at all
app.post('/user', (req, res) => {
  const user = req.body;
  db.save(user); // Could be anything
});
```

```ts
// TypeScript with `any`
app.post('/user', (req: any, res: any) => {
  const user = req.body;
  db.save(user);
});
```

**Why we did it:**
- JavaScript has no types.
- TypeScript was new and scary. `any` was the escape hatch.
- We valued "getting it done" over correctness.

**Why it's wrong now:**
- `any` disables TypeScript. You lose autocomplete, refactoring, and error detection.
- Bugs manifest at runtime instead of compile time.
- `any` is contagious. One `any` variable infects everything it touches.

### New Way (2025)

```ts
import { Request, Response } from 'express';
import { userSchema, User } from './validation.js';

app.post('/user', (req: Request, res: Response) => {
  const result = userSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }
  const user: User = result.data; // Strict, typed, validated
  db.save(user);
});
```

**Why it's better:**
- `User` type is inferred from the schema. If the schema changes, the type changes automatically.
- `req: Request` and `res: Response` give full Express autocomplete.
- No `any`. No unchecked data.

---

## 6. Error Handling: Generic vs Structured

### Old Way (2015–2020)

```js
app.post('/validate', (req, res) => {
  if (!req.body.name) {
    return res.status(400).json({ error: 'Bad request' });
  }
  // ...
});
```

**Why it's wrong:**
- Generic `"Bad request"` tells the frontend NOTHING.
- Frontend developers must guess which field failed.
- No machine-readable structure. Can't render field-level errors.

### New Way (2025)

```ts
res.status(400).json({
  valid: false,
  errors: [
    { field: 'name', message: 'String must contain at least 2 character(s)' },
    { field: 'email', message: 'Invalid email' },
  ],
});
```

**Why it's better:**
- Frontend can highlight the exact invalid fields.
- Machine-readable. Easy to translate, log, or transform.
- Consistent across all endpoints.

---

## Summary Table

| Pattern | Old (2015–2020) | New (2025) | Why Change |
|---------|-----------------|------------|------------|
| Validation | Manual `if/else` | Zod schema | Types, consistency, composition |
| Types | `any` / no types | Inferred from schema | Safety, autocomplete |
| Errors | Generic strings | Structured objects | Frontend UX, machine readability |
| Modules | CommonJS | ESM | Tree-shaking, top-level await |
| Async | Callbacks | `async/await` | Readability, error handling |

The old patterns were the best available. The new patterns are the best available now. Choosing the old ones in 2025 is a deliberate choice to accept technical debt.
