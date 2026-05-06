# v4-add-logging.md — "Something broke but I can't see what"

## The Bug

Your JSON validator returns 400 for bad input. But when the validation *itself* throws, you get a generic 500:

```ts
app.post('/validate', (req, res) => {
  const result = userSchema.safeParse(req.body);
  // ...
});
```

One day, `req.body` is `null` because a client sent an empty request. `safeParse(null)` works. But later, someone adds a custom refinement:

```ts
const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  age: z.number().int(),
}).refine((data) => data.age > 18, {
  message: 'Must be adult',
});
```

The `.refine` throws on certain edge cases. You don't know because there are no logs. The client gets 500. You get paged. You have no idea which request caused it or why.

## The 3am Page, Redux

A user complains: "I sent valid JSON and got 500." You check your terminal:

```
Server running on port 3000
```

That's it. The only log is the boot message. You add `console.log` everywhere:

```ts
app.post('/validate', (req, res) => {
  console.log('Got request', req.body);
  const result = userSchema.safeParse(req.body);
  console.log('Parse result', result);
  // ...
});
```

Now your terminal is a wall of text. Two requests interleave. You can't tell which log belongs to which request. You add timestamps manually and forget half the time.

## Adding Pino Structured Logging

```bash
npm install pino
```

```ts
// src/middleware/logger.ts
import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import { randomUUID } from 'node:crypto';

export function requestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    (req as Request & { id: string }).id = requestId;

    const startTime = Date.now();

    res.on('finish', () => {
      const durationMs = Date.now() - startTime;

      logger.info({
        requestId,
        method: req.method,
        path: req.url,
        statusCode: res.statusCode,
        durationMs,
        timestamp: new Date().toISOString(),
      }, 'request completed');
    });

    next();
  };
}
```

```ts
// src/app.ts
import { createLogger } from 'pino';
import { requestLogger } from './middleware/logger.js';

export const app = express();
app.use(express.json());

const logger = createLogger({
  name: 'json-validator',
  level: process.env.LOG_LEVEL || 'info',
});

app.use(requestLogger(logger));

app.post('/validate', (req: Request, res: Response) => {
  const result = userSchema.safeParse(req.body);

  if (!result.success) {
    logger.warn({
      requestId: (req as any).id,
      errors: result.error.errors,
    }, 'validation failed');

    const errors = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    res.status(400).json({ valid: false, errors });
    return;
  }

  logger.info({
    requestId: (req as any).id,
    user: result.data.email,
  }, 'validation passed');

  res.status(200).json({ valid: true, data: result.data });
});
```

Now you see:

```json
{
  "level": 30,
  "time": 1715123456789,
  "name": "json-validator",
  "requestId": "abc-123",
  "method": "POST",
  "path": "/validate",
  "statusCode": 400,
  "durationMs": 3,
  "msg": "request completed"
}
```

And for validation failures:

```json
{
  "level": 40,
  "time": 1715123456790,
  "name": "json-validator",
  "requestId": "abc-123",
  "errors": [
    { "path": ["age"], "message": "Expected number, received string" }
  ],
  "msg": "validation failed"
}
```

## Why Pino?

- **JSON output** is parseable by every log aggregator
- **Log levels** let you set `LOG_LEVEL=warn` in production to reduce noise
- **Child loggers** carry context (requestId) across async boundaries
- **Async writes** don't block the event loop

## Querying in Production

```bash
# Count validation failures by field
docker logs api | jq -s '
  map(select(.msg == "validation failed").errors[])
  | group_by(.path[0]) | map({ field: .[0].path[0], count: length })
'

# Find requests that took > 100ms (usually means heavy payload)
docker logs api | jq 'select(.durationMs > 100)'
```

## What Changed

- Added Pino for structured logging
- Every request gets a `requestId`
- Validation failures are logged at `warn` level
- Response time is captured for every request
- JSON logs enable aggregation and alerting

## What We Still Need

Logging shows us problems after they happen. But when we add a new validation rule or change the response format, we might break existing behavior. We need to catch that *before* deploy.

For that, we need tests.
