# S13 API Key Manager — v3 Add Validation

## The Bug: Validation Catches USER Bugs

Without validation, your API accepts anything:

```bash
curl -X POST http://localhost:3000/keys -H "Content-Type: application/json" -d '{"rate_limit": -1}'
curl http://localhost:3000/protected -H "x-api-key: pk_live_INVALID"
```

Your endpoints:
- Store negative rate limits → database constraint violation or infinite quota
- Accept any string as a key → no format validation
- Skip expiration checks → keys valid forever
- Ignore scopes → every key is an admin key

## The Fix: Hashing, Rate Limits, Expiration, and Scopes

```ts
// keys.ts
import { Router } from 'express';
import crypto from 'crypto';
import db from './db.js';

const router = Router();

function generateKey(): { prefix: string; fullKey: string; hash: string } {
  const prefix = 'pk_live_';
  const random = crypto.randomBytes(32).toString('hex');
  const fullKey = `${prefix}${random}`;
  const hash = crypto.createHash('sha256').update(fullKey).digest('hex');
  return { prefix, fullKey, hash };
}

router.post('/', (req, res) => {
  const { name, scopes, rate_limit, expires_in_days } = req.body;
  const { prefix, fullKey, hash } = generateKey();

  db.prepare(
    'INSERT INTO api_keys (prefix, key_hash, name, scopes, rate_limit, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    prefix,
    hash,
    name || null,
    scopes ? JSON.stringify(scopes) : null,
    Math.max(1, Math.min(rate_limit || 100, 10000)),
    expires_in_days ? Date.now() + expires_in_days * 86400000 : null
  );

  res.status(201).json({ key: fullKey, name });
});
```

```ts
// middleware.ts
import crypto from 'crypto';
import db from './db.js';

const rateLimits = new Map<string, { count: number; windowStart: number }>();

export function authMiddleware(req, res, next) {
  const key = req.headers['x-api-key'] as string;
  if (!key) return res.status(401).json({ error: 'Missing API key' });

  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const row = db.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND revoked = 0').get(hash) as
    | { id: number; key_hash: string; expires_at: number | null; rate_limit: number; scopes: string | null }
    | undefined;

  if (!row) return res.status(401).json({ error: 'Invalid API key' });

  // Check expiration
  if (row.expires_at && Date.now() > row.expires_at) {
    return res.status(401).json({ error: 'API key expired' });
  }

  // Rate limiting
  const now = Date.now();
  const windowStart = Math.floor(now / 60000) * 60000;
  const limitKey = `${row.id}:${windowStart}`;
  const current = rateLimits.get(limitKey) || { count: 0, windowStart };
  if (current.count >= row.rate_limit) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  current.count++;
  rateLimits.set(limitKey, current);

  req.apiKey = row;
  next();
}
```

**What this prevents:**
- Plaintext key storage
- Invalid rate limits
- Expired key usage
- Unlimited requests per key

## The Pain That Remains

You deploy to production. A support ticket arrives: *"My key was rejected but it looks correct."* You have zero visibility into:
- Was the key hash mismatching?
- Did it hit the rate limit?
- Was it expired?
- What scopes did it have?

## What v4 Fixes

Logging. Production without logs is flying blind.
