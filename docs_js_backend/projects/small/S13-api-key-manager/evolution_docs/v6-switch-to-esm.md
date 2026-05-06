# S13 API Key Manager — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your project uses `require()` and `module.exports`:

```js
// CommonJS — works, but dated
const express = require('express');
const crypto = require('crypto');

module.exports = router;
```

**Problems:**
1. No top-level await
2. `require()` loads synchronously and caches aggressively
3. Named exports are fragile
4. Modern packages ship ESM-only
5. `__dirname` and `__filename` are CJS-only

## The Fix: ESM

```json
// package.json
{
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

```ts
// src/index.ts
import app from './app.js';

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`S13 API Key Manager on ${PORT}`));
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

export default router;
```

**What ESM gives you:**
- Static analysis
- Explicit file extensions
- Modern Node.js alignment

## The Pain That Remains

You have TypeScript, hashing, rate limits, logging, tests, and ESM. But key rotation requires zero-downtime migration. You need multiple active keys per user, scope enforcement, and proper production hardening.

## What v7 Fixes

Final production setup. Key rotation, scope enforcement, and timing-safe comparison.
