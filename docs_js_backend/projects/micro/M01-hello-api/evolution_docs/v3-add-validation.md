# v3-add-validation.md — "Users send garbage data"

## The Bug

You add a POST endpoint to your hello API. Users can send their name and get a personalized greeting.

```ts
app.post('/greet', (req: Request, res: Response) => {
  const { name, age } = req.body;
  res.json({ message: `Hello, ${name}! You are ${age} years old.` });
});
```

A user sends:

```json
{ "name": "", "age": "not-a-number" }
```

Your response: `Hello, ! You are not-a-number years old.`

The frontend tries to render this and crashes. The user reports "the page goes blank." You blame the frontend. The frontend blames the API. The real problem: you accepted garbage and passed it through.

Another user sends:

```json
{ "name": "Alice", "age": 25, "isAdmin": true }
```

You don't use `isAdmin`. But you store this in a database. Someone else queries that database and trusts `isAdmin`. A regular user is now an admin.

This is the difference between **type safety** (catches *your* bugs) and **validation** (catches *user* bugs).

## The 3am Page, Redux

A client integration sends a malformed request:

```json
{ "nmae": "Alice", "age": 25 }
```

TypeScript on your side doesn't catch this — `req.body` is typed by you, not enforced at runtime. The code destructures `name` as `undefined`. The response is `Hello, undefined!`. The client gets a 200 and stores `undefined` in their database.

You need to validate what the user sends, not just what you write.

## Adding Zod Validation

```bash
npm install zod
```

```ts
// src/validation.ts
import { z } from 'zod';

export const greetSchema = z.object({
  name: z.string().min(2).max(50),
  age: z.number().int().min(0).max(150),
}).strict(); // reject extra fields

export type GreetInput = z.infer<typeof greetSchema>;
```

```ts
// src/app.ts
import { greetSchema } from './validation.js';

app.post('/greet', (req: Request, res: Response) => {
  const result = greetSchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    res.status(400).json({ valid: false, errors });
    return;
  }

  const { name, age } = result.data;
  res.json({ message: `Hello, ${name}! You are ${age} years old.` });
});
```

Now the same garbage input:

```json
{ "name": "", "age": "not-a-number" }
```

Returns:

```json
{
  "valid": false,
  "errors": [
    { "field": "name", "message": "String must contain at least 2 character(s)" },
    { "field": "age", "message": "Expected number, received string" }
  ]
}
```

**400 Bad Request.** The client knows exactly what they did wrong. Your database stays clean. Your frontend doesn't crash on unexpected data.

## Why `safeParse`?

`schema.parse()` throws on failure. `safeParse()` returns `{ success: boolean, data | error }`. In an Express handler, throwing means you need a global error handler. `safeParse` lets you return a 400 immediately with structured errors.

## What Changed

- Added Zod schema for request bodies
- `.strict()` rejects unexpected fields (security: no `isAdmin` injection)
- `safeParse` gives us structured 400 responses
- Types and validation work together: `z.infer<typeof greetSchema>` produces a TypeScript type

## What We Still Need

Validation catches bad data. But when something *else* breaks — a database timeout, a Redis failure, a logic bug — we still have no visibility. We're flying blind in production.

For that, we need logging.
