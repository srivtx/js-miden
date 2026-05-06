# S20 API Versioning — v4 Add Logging

## The Bug: Production Visibility Crisis

Your versioning layer is supposed to route clients correctly. But in production:
- You don't know which API version clients are using
- You don't know if v1 is still heavily used or ready for deprecation
- You can't tell if a client is hitting a deprecated endpoint
- You have no record of version transformation failures

```ts
// Without logging — silent routing
app.use((req: Request, res: Response, next: NextFunction) => {
  const accept = req.get('Accept') || '';
  if (accept.includes('application/vnd.api.v1+json')) {
    return v1Router(req, res, next);
  }
  if (accept.includes('application/vnd.api.v2+json')) {
    return v2Router(req, res, next);
  }
  next();
});
```

A client hits `/v1/users` 100,000 times a day. You have no idea. You deprecate v1. Their app breaks. They call support. You have no data to defend the decision.

## The Fix: Structured Logging

```ts
import { logger } from './logger.js';

app.use((req: Request, res: Response, next: NextFunction) => {
  const accept = req.get('Accept') || '';
  const version = accept.includes('application/vnd.api.v1+json') ? 'v1' :
                  accept.includes('application/vnd.api.v2+json') ? 'v2' : 'default';
  
  logger.info({ method: req.method, path: req.path, version, accept }, 'API request');
  
  if (version === 'v1') {
    logger.warn({ path: req.path }, 'Deprecated v1 endpoint accessed');
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString());
    return v1Router(req, res, next);
  }
  if (version === 'v2') {
    return v2Router(req, res, next);
  }
  next();
});
```

Now logs tell the story:
```json
{"level":"info","method":"GET","path":"/users","version":"v2","msg":"API request"}
{"level":"warn","path":"/users","msg":"Deprecated v1 endpoint accessed"}
{"level":"info","method":"GET","path":"/users","version":"v1","msg":"API request"}
```

**Ah.** v1 is still getting 40% of traffic. We can't sunset it yet. We need to notify those clients.

## The Pain That Remains

You add a transformation layer and accidentally break the v1 contract. Your logs show v1 requests returning 200, but you don't have a test that verifies the response shape matches the v1 schema.

## What v5 Fixes

Testing. Every version contract needs a test.
