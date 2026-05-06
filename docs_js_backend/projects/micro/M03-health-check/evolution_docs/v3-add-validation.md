# v3-add-validation.md — "Users send garbage data"

## The Bug

Your health check endpoint grows. Users can request different depths of health check:

```ts
app.get('/health', async (req: Request, res: Response) => {
  const depth = req.query.depth;

  if (depth === 'deep') {
    const health = await checkDeepHealth();
    res.json(health);
  } else {
    res.json({ status: 'ok' });
  }
});
```

A user sends `GET /health?depth=deep&timeout=0`. You ignore `timeout`. But a teammate adds:

```ts
const timeout = parseInt(req.query.timeout as string, 10);
await checkDeepHealth(timeout);
```

`timeout` is `0`. `parseInt('0', 10)` is `0`. The health check times out immediately and returns `unhealthy` for everything. The load balancer drains all traffic. The site is down because someone sent `timeout=0`.

You didn't validate the query parameters. You assumed `timeout` would be a reasonable number.

## The 3am Page, Redux

Someone sends `GET /health?depth=deeeep`. Your code falls through to the shallow check. The ops dashboard shows green, but the deep check (which catches the real problem) never ran. The database is about to fail and nobody knows.

Query parameters are user input. They need validation just like request bodies.

## Adding Zod Validation

```bash
npm install zod
```

```ts
// src/validation.ts
import { z } from 'zod';

export const healthQuerySchema = z.object({
  depth: z.enum(['shallow', 'deep']).default('shallow'),
  timeout: z.coerce.number().int().min(1000).max(30000).default(5000),
}).strict();

export type HealthQuery = z.infer<typeof healthQuerySchema>;
```

```ts
// src/index.ts
import { healthQuerySchema } from './validation.js';

app.get('/health', async (req: Request, res: Response) => {
  const parseResult = healthQuerySchema.safeParse(req.query);

  if (!parseResult.success) {
    return res.status(400).json({
      valid: false,
      errors: parseResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const { depth, timeout } = parseResult.data;

  if (depth === 'deep') {
    const health = await checkDeepHealth(timeout);
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } else {
    res.json({ status: 'ok' });
  }
});
```

Now:

- `GET /health?depth=deeeep` → 400, `"Invalid enum value. Expected 'shallow' | 'deep', received 'deeeep'"`
- `GET /health?timeout=0` → 400, `"Number must be greater than or equal to 1000"`
- `GET /health` → defaults to `depth: 'shallow'`, `timeout: 5000`

## Why `coerce`?

Query parameters are always strings. `z.coerce.number()` converts `"5000"` to `5000`. Without coercion, `z.number()` would reject `"5000"` as a string.

## What Changed

- Added Zod for query parameter validation
- `enum` restricts `depth` to known values
- `coerce.number()` with `.min()` and `.max()` prevents timeout abuse
- `.default()` provides sensible fallbacks

## What We Still Need

Validation protects against bad input. But when the database actually goes down, or Redis disappears, we need to know. We need to see what happened, when, and for which request.

For that, we need structured logging.
