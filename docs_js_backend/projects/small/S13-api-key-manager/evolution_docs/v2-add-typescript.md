# S13 API Key Manager — v2 Add TypeScript

## The Bug: Types Catch YOUR Bugs

You add key revocation:

```js
app.delete('/keys/:id', (req, res) => {
  const key = keys.get(req.params.id);
  key.revoked = true; // TypeError: Cannot set property 'revoked' of undefined
  res.json({ revoked: true });
});
```

**The bug:** `req.params.id` is a string, but `keys` is a Map keyed by the full API key, not an ID. You meant to query by database row ID. JavaScript silently returns `undefined`. You set `revoked` on `undefined` and crash.

Another bug: you treat `expires_at` as a string:

```js
if (key.expires_at < Date.now()) { // '2026-01-01' < 1715097600000 — works by accident
```

TypeScript would flag `expires_at` as `number | null` vs `string`.

## The Fix: Add TypeScript

```ts
// types.ts
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
// keys.ts
import { Router } from 'express';
import crypto from 'crypto';
import db from './db.js';

const router = Router();

function generateKey(): { prefix: string; fullKey: string } {
  const prefix = 'pk_live_';
  const random = crypto.randomBytes(32).toString('hex');
  return { prefix, fullKey: `${prefix}${random}` };
}

router.post('/', (req, res) => {
  const { name, scopes, rate_limit, expires_in_days } = req.body;
  const { prefix, fullKey } = generateKey();

  db.prepare(
    'INSERT INTO api_keys (prefix, key_hash, name, scopes, rate_limit, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    prefix,
    fullKey,
    name || null,
    scopes ? JSON.stringify(scopes) : null,
    rate_limit || 100,
    expires_in_days ? Date.now() + expires_in_days * 86400000 : null
  );

  res.status(201).json({ key: fullKey, name });
});
```

Now `tsc` errors on:
```
keys.ts:15:28 - error TS2339: Property 'revoked' does not exist on type 'undefined'.
```

## But TypeScript Doesn't Catch Everything

TypeScript validates **compile-time** shapes, not **runtime** security. A client can still:
- Store plaintext keys
- Skip rate limiting
- Ignore expiration dates
- Access any endpoint with any key

We need runtime hardening.

> **Lesson:** TypeScript eliminates typos and wrong shapes. But runtime security is required because attackers don't respect types.

## What v3 Fixes

Validation. Hash keys with SHA-256, enforce rate limits, check expiration, and validate scopes.
