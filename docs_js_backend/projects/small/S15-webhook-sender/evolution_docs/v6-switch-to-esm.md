# S15 Webhook Sender — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your project uses `require()` and `module.exports`:

```js
// CommonJS — works, but dated
const express = require('express');
const fetch = require('node-fetch');

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
import 'dotenv/config';
import app from './app.js';
import { initDb } from './db.js';

const PORT = process.env.PORT || 3000;

async function main() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`S15 Webhook Sender listening on port ${PORT}`);
  });
}

main().catch(console.error);
```

```ts
// src/services/sender.ts
import fetch from 'node-fetch';
import { pool } from '../db.js';
import { generateSignature } from '../utils/signature.js';
import type { DeliveryLog } from '../types.js';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const TIMEOUT_MS = 10000;

export async function sendWebhook(log: DeliveryLog) {
  const webhookRes = await pool.query('SELECT * FROM webhooks WHERE id = $1', [log.webhook_id]);
  const webhook = webhookRes.rows[0];
  if (!webhook) return;

  const signature = generateSignature(log.payload, webhook.secret);

  let lastError: Error | null = null;
  for (let attempt = log.attempt_count; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': log.event_type,
          'X-Webhook-Attempt': String(attempt + 1),
        },
        body: JSON.stringify(log.payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        await pool.query(
          `UPDATE delivery_logs 
           SET status = 'success', response_status = $1, attempt_count = $2, updated_at = NOW()
           WHERE id = $3`,
          [response.status, attempt + 1, log.id]
        );
        return;
      } else {
        lastError = new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      clearTimeout(timeout);
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000;
    await new Promise((r) => setTimeout(r, delay));
  }

  await pool.query(
    `UPDATE delivery_logs 
     SET status = 'failed', response_body = $1, updated_at = NOW()
     WHERE id = $2`,
    [lastError?.message || 'Unknown error', log.id]
  );
}
```

**What ESM gives you:**
- Static analysis
- Explicit file extensions
- Modern Node.js alignment

## The Pain That Remains

You have TypeScript, retries, backoff, logging, tests, and ESM. But you send the same event twice and the receiver processes it twice. You need idempotency. You also need the receiver to verify the HMAC signature.

## What v7 Fixes

Final production setup. Payload signing with HMAC, idempotency keys, and delivery guarantees.
