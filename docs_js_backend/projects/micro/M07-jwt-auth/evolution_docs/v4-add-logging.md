# v4-add-logging.md — "Something broke but I can't see what"

## The Bug

Users report they can't log in. You check the database — users exist. You check the JWT secret — it's set. You have no logs.

You add `console.log`:

```ts
router.post('/login', (req, res) => {
  console.log('Login attempt:', req.body.userId);
  // ...
});
```

The output:

```
Login attempt: alice
Login attempt: bob
Login attempt: undefined
Login attempt: undefined
Login attempt: undefined
```

`undefined`. Three times in a row. Is it the same client? Different clients? A bot? You can't tell. You add more logs:

```ts
console.log('Headers:', req.headers);
```

Now you're logging authorization tokens to stdout. Anyone with server access can steal them. Your logs are a security liability.

## The 3am Page, Redux

A security incident: someone used a stolen token. You need to know when it was issued, for which user, from which IP. You have no logs. Your `console.log` only prints the userId. No timestamp. No IP. No token metadata.

You check the database. It has no record of issued tokens. JWTs are stateless. Without logs, a stolen token is untraceable.

## Adding Pino Structured Logging

```bash
npm install pino
```

```ts
// src/server.ts
import { createLogger } from 'pino';

const app = express();
const logger = createLogger({
  name: 'jwt-auth',
  level: process.env.LOG_LEVEL || 'info',
  // Redact sensitive fields automatically
  redact: ['req.headers.authorization', 'password', 'token'],
});

app.use((req, res, next) => {
  const requestId = randomUUID();
  (req as any).id = requestId;

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
});
```

```ts
// src/routes/auth.ts
router.post('/login', (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    logger.warn({ requestId: (req as any).id, errors: result.error.errors }, 'login validation failed');
    return res.status(400).json({ valid: false, errors: result.error.errors });
  }

  const { userId } = result.data;
  logger.info({ requestId: (req as any).id, userId }, 'login success');

  const token = jwt.sign({ sub: userId }, SECRET, { expiresIn: '1h', algorithm: 'HS256' });
  res.json({ token });
});
```

Now:

```json
{
  "level": 30,
  "time": 1715123456789,
  "name": "jwt-auth",
  "requestId": "abc-123",
  "method": "POST",
  "path": "/login",
  "statusCode": 200,
  "durationMs": 12,
  "msg": "request completed"
}
```

And:

```json
{
  "level": 30,
  "time": 1715123456790,
  "name": "jwt-auth",
  "requestId": "abc-123",
  "userId": "alice",
  "msg": "login success"
}
```

With `redact`, even if you accidentally log `req.headers.authorization`, Pino replaces it with `[Redacted]`.

## Why Pino?

- **Redaction** prevents credential leaks in logs
- **JSON** is parseable by SIEM tools
- **Request IDs** trace auth events across the system
- **Log levels** let you set `LOG_LEVEL=warn` to avoid logging every login

## Querying in Production

```bash
# Failed logins by user
docker logs api | jq -s '
  map(select(.msg == "login validation failed"))
  | group_by(.errors[].path[0]) | map({ field: .[0].errors[0].path[0], count: length })
'

# Login attempts per minute (detect brute force)
docker logs api | jq -s '
  map(select(.msg == "login success"))
  | group_by(.time / 60000 | floor)
  | map({ minute: .[0].time, count: length })
'
```

## What Changed

- Added Pino for structured logging
- `redact` option prevents credential leaks
- Every request gets a `requestId`
- Login events are logged with userId
- Validation failures are logged for security auditing

## What We Still Need

Logging shows us auth events after they happen. But when we add refresh tokens or change JWT expiry, we might break existing login flows or token verification. We need to catch that before deploy.

For that, we need tests.
