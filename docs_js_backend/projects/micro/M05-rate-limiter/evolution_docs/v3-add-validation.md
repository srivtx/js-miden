# v3-add-validation.md — "Users send garbage data"

## The Bug

Your rate limiter is configured via environment variables:

```ts
const WINDOW_SIZE_MS = parseInt(process.env.WINDOW_MS || '60000', 10);
const MAX_REQUESTS = parseInt(process.env.MAX_REQS || '10', 10);
```

Ops deploys with:

```bash
WINDOW_MS=not-a-number
MAX_REQS=-1
```

`parseInt('not-a-number', 10)` returns `NaN`. The rate limiter creates Redis keys with `NaN` in the name. Redis accepts the key. The math `NaN > MAX_REQUESTS` is always `false`. The rate limiter never blocks anything.

`MAX_REQS = -1`. `current > -1` is true for every request. Every request is blocked. The API is completely down.

Both config values passed `parseInt`. Both produced valid `number` types in TypeScript. Neither was valid semantically.

## The 3am Page, Redux

A developer changes the config:

```bash
WINDOW_MS=1000
MAX_REQS=1000000
```

They meant `MAX_REQS=100`. One extra zero. The rate limiter allows a million requests per second. Your API melts under load. The developer insists "I set it to 100." They didn't. But there's no validation to catch it.

## Adding Zod Validation

```bash
npm install zod
```

```ts
// src/config.ts
import { z } from 'zod';

export const configSchema = z.object({
  windowSizeMs: z.coerce.number().int().min(1000).max(3600000).default(60000),
  maxRequests: z.coerce.number().int().min(1).max(10000).default(10),
});

export type RateLimitConfig = z.infer<typeof configSchema>;

export const config = configSchema.parse({
  windowSizeMs: process.env.WINDOW_MS,
  maxRequests: process.env.MAX_REQS,
});
```

Now bad config values throw at startup:

```
ZodError: [
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "nan",
    "path": ["windowSizeMs"],
    "message": "Expected number, received nan"
  }
]
```

The server refuses to start. The bad deploy is caught before it serves a single request.

## Why `coerce`?

Environment variables are strings. `z.coerce.number()` converts `"60000"` to `60000`. Without it, `z.number()` rejects strings.

## Why `.parse` instead of `.safeParse`?

For config, we want to **crash at boot**. If config is wrong, the server shouldn't start and pretend everything is fine. `parse` throws. We catch it in `index.ts` and exit with a clear error.

## What Changed

- Added Zod for environment variable validation
- `coerce.number()` handles string env vars
- `.min()` and `.max()` prevent absurd values
- Invalid config crashes at startup, not at runtime

## What We Still Need

Validation keeps config sane. But when Redis is slow, or a client is legitimately being blocked, or the rate limiter itself throws an error, we need to see what happened. We need request-level visibility.

For that, we need structured logging.
