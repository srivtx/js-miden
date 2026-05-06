# S13 API Key Manager — v4 Add Logging

## The Bug: Production Visibility Crisis

You deploy v3. Support ticket arrives: *"My request was rejected but the key looks correct."*

You check the code. It looks correct. You have zero visibility into:

- What key did the client actually send?
- Was it a hash mismatch, expiration, or rate limit?
- What was the expected vs actual value?
- How many requests has this key made?

```ts
// Without logging — silent rejection
app.get('/protected', authMiddleware, (req, res) => {
  res.json({ message: 'Access granted' });
  // If auth failed, the client gets 401 with no context
});
```

## The Fix: Structured Logging

```ts
// middleware.ts
import { logger } from './logger.js';

export function authMiddleware(req, res, next) {
  const key = req.headers['x-api-key'] as string;
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();

  logger.debug({ requestId, keyPrefix: key?.slice(0, 8) }, 'Authenticating API key');

  if (!key) {
    logger.warn({ requestId }, 'Missing API key');
    return res.status(401).json({ error: 'Missing API key' });
  }

  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const row = db.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND revoked = 0').get(hash);

  if (!row) {
    logger.warn({ requestId, keyHash: hash.slice(0, 16) }, 'Invalid API key');
    return res.status(401).json({ error: 'Invalid API key' });
  }

  if (row.expires_at && Date.now() > row.expires_at) {
    logger.warn({ requestId, keyId: row.id }, 'API key expired');
    return res.status(401).json({ error: 'API key expired' });
  }

  // Rate limiting
  const now = Date.now();
  const windowStart = Math.floor(now / 60000) * 60000;
  const limitKey = `${row.id}:${windowStart}`;
  const current = rateLimits.get(limitKey) || { count: 0, windowStart };
  if (current.count >= row.rate_limit) {
    logger.warn({ requestId, keyId: row.id, count: current.count }, 'Rate limit exceeded');
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  current.count++;
  rateLimits.set(limitKey, current);

  logger.info({ requestId, keyId: row.id, scopes: row.scopes }, 'API key authenticated');
  req.apiKey = row;
  next();
}
```

Now your logs tell the story:
```json
{"level":"warn","requestId":"abc","keyHash":"a1b2c3d4...","msg":"Invalid API key"}
{"level":"warn","requestId":"def","keyId":3,"count":101,"msg":"Rate limit exceeded"}
```

## The Pain That Remains

You add scope enforcement but forget to handle the case where `scopes` is `null` (all scopes allowed). Your test with a scoped key passes, but the null case breaks. No test caught it.

## What v5 Fixes

Testing. Silent breakage when adding features is unacceptable.
