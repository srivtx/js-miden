# v3-add-validation.md — "Users send garbage data"

## The Bug

Your login endpoint accepts whatever the client sends:

```ts
app.post('/login', (req: Request, res: Response) => {
  const { userId, password } = req.body;

  if (!userId || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  // ...
});
```

A user sends:

```json
{ "userId": "", "password": "" }
```

Both fields are present. Your check passes. The empty string is a valid `userId` in your database. The empty string is a valid password hash (because you hash everything). An empty user logs in as an empty user. You have no idea how many empty-string accounts exist.

Another user sends:

```json
{ "userId": "admin'; DROP TABLE users; --" }
```

You're using parameterized queries, so SQL injection fails. But the userId is stored in a JWT. That JWT is logged. The log parser chokes on the SQL syntax. Your log aggregation pipeline breaks.

## The 3am Page, Redux

A botnet discovers your login endpoint. They send:

```json
{ "userId": "a", "password": "a" }
{ "userId": "a", "password": "b" }
{ "userId": "a", "password": "c" }
// ... 10,000 more
```

You have no rate limiting. You have no account lockout. The botnet is brute-forcing passwords against your API. You don't notice until the database CPU hits 100%.

## Adding Zod Validation

```bash
npm install zod
```

```ts
// src/validation.ts
import { z } from 'zod';

export const loginSchema = z.object({
  userId: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(100),
}).strict();

export type LoginInput = z.infer<typeof loginSchema>;
```

```ts
// src/routes/auth.ts
import { loginSchema } from '../validation.js';

router.post('/login', (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      valid: false,
      errors: result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const { userId, password } = result.data;
  // ...
});
```

Now:

- `{ "userId": "", "password": "" }` → 400, `"String must contain at least 3 character(s)"`
- `{ "userId": "admin'; DROP..." }` → 400, `"Invalid"` (regex rejects special chars)
- `{ "userId": "alice", "password": "short" }` → 400, `"String must contain at least 8 character(s)"`

## Why `.regex()`?

The regex `/^[a-zA-Z0-9_-]+$/` restricts `userId` to alphanumeric, underscore, and hyphen. This prevents injection attacks, log corruption, and weird Unicode tricks that bypass filters.

## What Changed

- Added Zod schema for login input
- `.min()` prevents empty strings
- `.max()` prevents absurdly long input (DoS protection)
- `.regex()` prevents injection and special characters
- `.strict()` rejects unknown fields

## What We Still Need

Validation stops garbage input. But when a login fails, or a token is rejected, or someone is brute-forcing accounts, we need logs. We need to see patterns of abuse.

For that, we need structured logging.
