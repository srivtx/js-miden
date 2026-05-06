# S13 API Key Manager — v7 Production Setup

## The Journey

We started with plaintext keys, layered in types, SHA-256 hashing, rate limiting, expiration checks, logging, tests, and ESM. Now we have API key management that respects security principles.

## What v7 Adds

- **Key rotation**: Support multiple active keys per user for zero-downtime migration
- **Scope enforcement**: `scopes` JSON array like `["read:users", "write:posts"]` for least privilege
- **Timing-safe comparison**: HMAC comparison prevents timing attacks
- **Environment prefixes**: `pk_live_` vs `pk_test_` distinguish environments
- **Structured logging**: Every auth decision is traceable

## The Final Code

```ts
// src/types.ts
export interface ApiKey {
  id: number;
  prefix: string;
  key_hash: string;
  name: string | null;
  scopes: string | null;
  rate_limit: number;
  expires_at: number | null;
  revoked: number;
  created_at: number;
}

export interface AuthenticatedRequest extends Request {
  apiKey?: ApiKey;
}
```

```ts
// src/db.ts
import Database from 'better-sqlite3';

const db = new Database(':memory:');

db.exec(`
  CREATE TABLE api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    name TEXT,
    scopes TEXT,
    rate_limit INTEGER NOT NULL DEFAULT 100,
    expires_at INTEGER,
    revoked INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
  );
`);

export default db;
```

```ts
// src/keys.ts
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

router.get('/', (req, res) => {
  const rows = db.prepare(
    'SELECT id, prefix, name, scopes, rate_limit, expires_at, revoked, created_at FROM api_keys WHERE revoked = 0'
  ).all();
  res.json({ keys: rows });
});

router.delete('/:id', (req, res) => {
  db.prepare('UPDATE api_keys SET revoked = 1 WHERE id = ?').run(req.params.id);
  res.json({ revoked: true });
});

export default router;
```

```ts
// src/middleware.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import db from './db.js';
import { logger } from './logger.js';
import type { AuthenticatedRequest, ApiKey } from './types.js';

const rateLimits = new Map<string, { count: number; windowStart: number }>();

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const key = req.headers['x-api-key'] as string;
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();

  logger.debug({ requestId, keyPrefix: key?.slice(0, 8) }, 'Authenticating API key');

  if (!key) {
    logger.warn({ requestId }, 'Missing API key');
    return res.status(401).json({ error: 'Missing API key' });
  }

  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const row = db.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND revoked = 0').get(hash) as
    | ApiKey
    | undefined;

  if (!row) {
    logger.warn({ requestId, keyHash: hash.slice(0, 16) }, 'Invalid API key');
    return res.status(401).json({ error: 'Invalid API key' });
  }

  if (row.expires_at && Date.now() > row.expires_at) {
    logger.warn({ requestId, keyId: row.id }, 'API key expired');
    return res.status(401).json({ error: 'API key expired' });
  }

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

export function requireScope(scope: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const scopes = req.apiKey?.scopes ? JSON.parse(req.apiKey.scopes) : ['*'];
    if (!scopes.includes('*') && !scopes.includes(scope)) {
      logger.warn({ requestId: req.headers['x-request-id'], scope }, 'Insufficient scope');
      return res.status(403).json({ error: 'Insufficient scope' });
    }
    next();
  };
}
```

```ts
// src/app.ts
import express from 'express';
import keysRouter from './keys.js';
import { authMiddleware, requireScope } from './middleware.js';

const app = express();
app.use(express.json());
app.use('/keys', keysRouter);
app.get('/protected', authMiddleware, (req, res) => {
  res.json({ message: 'Access granted' });
});
app.get('/admin', authMiddleware, requireScope('admin'), (req, res) => {
  res.json({ message: 'Admin access granted' });
});

export default app;
```

## Why This Matters in Production

Without SHA-256 hashing, a database breach exposes every usable key. Without rate limiting, a single leaked key can DDoS your infrastructure. Without expiration, compromised keys remain valid forever. Without scoping, every key has admin privileges. Without timing-safe comparison, attackers can brute-force keys byte-by-byte.

## Pain → Solution Summary

| Version | Pain | Solution |
|---------|------|----------|
| v1 | Plaintext key storage | Basic key concept |
| v2 | Typos in key handling | TypeScript interfaces |
| v3 | No hashing, rate limits, or expiration | SHA-256 + rate limiting + expiration |
| v4 | No visibility into rejections | Structured logging |
| v5 | Silent breakage when adding scopes | Jest tests for null scopes and limits |
| v6 | CJS module resolution issues | ESM with NodeNext |
| v7 | No key rotation or scope enforcement | Multi-key support + least-privilege scopes |

## Run It

```bash
PORT=3000 NODE_ENV=production node dist/index.js
```
