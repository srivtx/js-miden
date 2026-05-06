# v3-add-validation.md — "Users send garbage data"

## The Bug

Your JSON validator accepts anything and returns it:

```ts
app.post('/validate', (req: Request, res: Response) => {
  res.json({ valid: true, data: req.body });
});
```

A user sends:

```json
{
  "name": "",
  "email": "not-an-email",
  "age": "twenty-five"
}
```

You return `{ valid: true, data: { name: "", email: "not-an-email", age: "twenty-five" } }`.

The downstream service inserts `"twenty-five"` into an integer column. The database throws. The downstream service crashes. Their on-call pages *them* at 3am. They page *you*.

You argue: "I just validated that it's JSON. It's valid JSON." They argue: "We expected actual user data, not a syntax check."

Another user sends:

```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "age": 25,
  "isAdmin": true,
  "password": "hunter2"
}
}
```

You echo `isAdmin` and `password` back. The client didn't expect those fields. They store the response in a cache. Now their cache contains admin credentials.

Validation isn't about JSON syntax. It's about **domain constraints**.

## The 3am Page, Redux

You try a naive approach:

```ts
app.post('/validate', (req: Request, res: Response) => {
  const body = req.body;
  if (!body.name || !body.email || !body.age) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  res.json({ valid: true, data: body });
});
```

A user sends `{ name: "", email: "x", age: -5 }`. All fields are present. Your check passes. The garbage flows downstream.

Manual validation with `if` statements is incomplete, repetitive, and error-prone. You forget to check `age > 0`. You forget to validate email format. You forget to reject extra fields.

## Adding Zod Validation

```bash
npm install zod
```

```ts
// src/validation.ts
import { z } from 'zod';

export const userSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().int().min(18).max(120),
}).strict(); // reject extra fields

export type User = z.infer<typeof userSchema>;
```

```ts
// src/app.ts
import { userSchema } from './validation.js';

app.post('/validate', (req: Request, res: Response) => {
  const result = userSchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    res.status(400).json({ valid: false, errors });
    return;
  }

  res.status(200).json({ valid: true, data: result.data });
});
```

Now garbage input:

```json
{ "name": "", "email": "not-an-email", "age": "twenty-five" }
```

Returns:

```json
{
  "valid": false,
  "errors": [
    { "field": "name", "message": "String must contain at least 2 character(s)" },
    { "field": "email", "message": "Invalid email" },
    { "field": "age", "message": "Expected number, received string" }
  ]
}
```

And extra fields:

```json
{ "name": "Alice", "email": "a@b.com", "age": 25, "isAdmin": true }
```

Returns:

```json
{
  "valid": false,
  "errors": [
    { "field": "", "message": "Unrecognized key(s) in object: 'isAdmin'" }
  ]
}
```

**Security:** extra fields are rejected. **Clarity:** every error tells the user exactly what's wrong. **Safety:** downstream services only receive validated data.

## Why Not JSON.parse or Manual Checks?

- `JSON.parse` checks syntax, not semantics
- Manual `if` checks are incomplete and unmaintainable
- Zod schemas are the **single source of truth** for what a valid request looks like
- `z.infer` generates TypeScript types, so validation and types stay in sync

## What Changed

- Added Zod dependency
- `userSchema` defines valid name, email, age constraints
- `.strict()` prevents field injection
- `safeParse` returns structured errors instead of throwing

## What We Still Need

Validation catches bad input. But when a bug slips through — a typo in the response shape, a handler that throws — we have no logs. We can't trace what happened or when.

For that, we need structured logging.
