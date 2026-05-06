# S13 API Key Manager — v1 Simple JS

## The Naive Beginning

You need to protect an API. The simplest thing: store keys in plaintext and check them directly.

```js
// server.js
const express = require('express');
const crypto = require('crypto');
const app = express();
app.use(express.json());

const keys = new Map();

app.post('/keys', (req, res) => {
  const key = 'pk_live_' + crypto.randomBytes(32).toString('hex');
  keys.set(key, { name: req.body.name, createdAt: Date.now() });
  res.status(201).json({ key, name: req.body.name });
});

app.get('/protected', (req, res) => {
  const key = req.headers['x-api-key'];
  if (!keys.has(key)) return res.status(401).json({ error: 'Invalid key' });
  res.json({ message: 'Access granted' });
});

app.listen(3000);
```

**"This works. No hashing needed. Ship it."**

## The Pain in Production

### 1. Plaintext Storage Breach

Your database is dumped. Attacker has every API key in usable form. They don't need to crack anything. Every key is immediately valid.

### 2. No Rate Limiting

A leaked key is used to hammer your API at 10,000 req/s. Your infrastructure melts. You have no way to throttle per key.

### 3. No Expiration

A key created in 2022 is still active in 2026. An ex-employee still has access. A compromised key is valid forever unless manually revoked.

### 4. No Scoping

Every key has full access. A read-only mobile app key can delete data. A logging service key can modify billing.

### 5. Timing Attacks

SQLite string comparison `WHERE key_hash = ?` short-circuits on mismatch. An attacker measures response times and brute-forces keys byte-by-byte.

## What We Have

- **Plaintext keys** — database breach = total compromise
- **No rate limiting** — one key can DDoS your API
- **No expiration** — keys are valid forever
- **No scoping** — all keys are admin keys
- **Timing-unsafe comparison** — brute-forceable

## What v2 Fixes

TypeScript. Before we solve security, let's stop type confusion from compiling.
