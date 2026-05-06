# v4-add-logging.md — Password Hasher

## The Pain

In production, hashing and verification errors were **invisible**:

```typescript
app.post('/hash', (req, res) => {
  const parse = hashSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }
  const { password } = parse.data;
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  res.json({ hash });
});
```

1. A validation failure returns 400 to the client, but **nobody on the server knows** it happened.
2. A brute-force attack sending thousands of `/verify` requests? No trace in logs.
3. The server crashes at 3 AM with `TypeError`? The process manager restarts it, but we have no idea why.

We had `console.log` scattered in a few places, but:
- No timestamps
- No log levels (info, warn, error)
- No request correlation
- Mixed with stdout from other libraries

## The Fix: Add Structured Logging

```typescript
// logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'password-hasher' },
});
```

```typescript
// routes.ts
import { logger } from './logger.js';

app.post('/hash', (req, res) => {
  const parse = hashSchema.safeParse(req.body);
  if (!parse.success) {
    logger.warn({ errors: parse.error.flatten() }, 'Hash validation failed');
    return res.status(400).json({ error: parse.error.flatten() });
  }

  logger.info({ ip: req.ip }, 'Hashing password');
  const { password } = parse.data;
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  res.json({ hash });
});
```

Now logs look like:
```json
{"level":30,"time":1715000000000,"service":"password-hasher","msg":"Hashing password","ip":"::1"}
{"level":40,"time":1715000000100,"service":"password-hasher","msg":"Hash validation failed","errors":{"fieldErrors":{"password":["Password cannot be empty"]}}}
```

## But Logging Doesn't Fix the Hash Algorithm

We're still using SHA-256 and `===`. Logging makes problems **visible**, but it doesn't make them **fixed**. The logs will show brute-force attempts, but the hash is still fast enough to allow them.

> **Lesson:** Logging turns invisible failures into observable data. But observable insecure code is still insecure code.
