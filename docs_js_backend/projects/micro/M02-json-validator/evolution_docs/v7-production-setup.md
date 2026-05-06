# v7-production-setup.md — "The final version"

## The Journey

We started with an endpoint that called `JSON.parse` on an already-parsed body:

```js
app.post('/validate', (req, res) => {
  const data = JSON.parse(req.body);
  res.json({ valid: true, data });
});
```

It crashed. We fixed it. Then we realized "valid JSON" and "valid data" are not the same thing.

Here's what we added and why:

| Step | What we added | What bug it prevents |
|------|--------------|----------------------|
| v1 | Simple JS + JSON.parse | Crashes on `req.body` being an object |
| v2 | TypeScript | `req.body.emial` → caught at compile time |
| v3 | Zod validation | `{ age: "twenty-five" }` → 400 with field-level errors |
| v4 | Pino logging | Mystery 500s → searchable JSON with request context |
| v5 | Vitest + Supertest | Schema changes break response → caught in CI |
| v6 | ESM | `require`/`module.exports` mess → clean imports |
| v7 | Production setup | Everything wired, intentional bug to find |

## Final File Structure

```
M02-json-validator/
├── src/
│   ├── index.ts          # Entry point: start server
│   ├── app.ts            # Express app with validation endpoint
│   └── validation.ts     # Zod schema and TypeScript types
├── tests/
│   └── app.test.ts       # Vitest + Supertest: valid, invalid, extra fields
├── package.json          # ESM, scripts, dependencies
├── tsconfig.json         # strict, NodeNext module resolution
└── evolution_docs/       # This file and the journey
```

## Each File Explained

### `src/index.ts`

```ts
import { app } from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

- ESM import with `.js` extension
- No `createApp` factory needed here — the app is a singleton

### `src/app.ts`

```ts
import express, { Request, Response } from 'express';
import { userSchema } from './validation.js';

export const app = express();

app.use(express.json());

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

- `express.json()` parses the body *once*
- `userSchema.safeParse` validates at runtime
- Structured 400 responses with field-level errors
- `.strict()` in the schema rejects extra fields (security)

### `src/validation.ts`

```ts
import { z } from 'zod';

export const userSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().int().min(18).max(120),
}).passthrough();  // <-- BUG IS HERE

export type User = z.infer<typeof userSchema>;
```

- `z.string().email()` validates format, not just type
- `z.number().int()` rejects floats
- `.min(18).max(120)` enforces business rules

## The Intentional Bug

`.passthrough()` allows extra fields instead of stripping them. The schema says it should reject unknown keys (Phase 3 decision was `.strict()`), but `.passthrough()` lets them through.

A client sends:

```json
{ "name": "Alice", "email": "a@b.com", "age": 25, "isAdmin": true }
```

The response includes `isAdmin: true`. Downstream services might trust this field.

**Fix:** Change `.passthrough()` to `.strict()`.

## Running It

```bash
npm install
npm run dev
npm test
npm run build
npm start
```

## Why This Matters

Validation is the boundary between "your bugs" and "user bugs." TypeScript catches the former. Zod catches the latter. Without both, you're shipping a broken contract.

The `.passthrough()` bug is intentional. Find it. Fix it. The lesson: schemas are security boundaries. A single word difference (`passthrough` vs `strict`) changes your API from safe to dangerous.
