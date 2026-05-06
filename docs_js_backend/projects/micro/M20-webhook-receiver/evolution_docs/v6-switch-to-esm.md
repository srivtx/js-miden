# M20 Webhook Receiver — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your webhook receiver uses `require()`:

```js
const express = require('express');
const crypto = require('crypto');
```

**Problems:**
1. No top-level await — can't async-load secrets from a vault at startup
2. Named exports are messy — `module.exports = { verifyWebhook }` vs `exports.verifyWebhook`
3. Modern crypto utilities are increasingly ESM-only
4. Dynamic `require()` can hide dependencies from security audits

## The Fix: ESM

```json
// package.json
{
  "name": "m20-webhook-receiver",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

```ts
// webhook.ts
import { IncomingHttpHeaders } from 'http';
import crypto from 'crypto';

const SECRETS: Record<string, string> = {
  github: process.env.GITHUB_WEBHOOK_SECRET || 'default-github-secret',
  stripe: process.env.STRIPE_WEBHOOK_SECRET || 'default-stripe-secret',
};
```

```ts
// index.ts
import express, { Request, Response } from 'express';
import { verifyWebhook, processEventAsync, getEvents, isValidProvider } from './webhook.js';

const app = express();
app.use(express.raw({ type: 'application/json', limit: '1mb' }));
// ...
export default app;
```

**What ESM gives you:**
- Named imports are explicit — `import { verifyWebhook } from './webhook.js'`
- File extensions required — no resolution ambiguity
- Static analysis — security scanners can trace crypto usage

## The Pain That Remains

You have TypeScript, validation, logging, tests, and ESM. But `webhook.ts` mixes verification, idempotency tracking, and async processing. `index.ts` is in the project root. Time to productionize.

## What v7 Fixes

Final production setup. Clean `src/` directory, signature verification, replay protection, idempotency, async processing.
