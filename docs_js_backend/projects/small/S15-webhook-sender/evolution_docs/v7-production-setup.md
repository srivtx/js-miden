# S15 Webhook Sender — v7 Production Setup

## The Journey

We started with fire-and-forget, layered in types, retry logic, exponential backoff, delivery logging, tests, and ESM. Now we have webhook delivery that respects reliability and security.

## What v7 Adds

- **Retry with exponential backoff**: `BASE_DELAY_MS * 2^attempt + jitter`
- **HMAC payload signing**: `X-Webhook-Signature: sha256=...` for integrity
- **Idempotency**: `X-Webhook-Id` header lets receivers deduplicate
- **Delivery logging**: Every attempt is tracked in `delivery_logs`
- **AbortController timeout**: Prevents hanging requests
- **Dead letter queue**: Failed deliveries after max retries are recorded

## The Final Code

```ts
// src/types.ts
export interface Webhook {
  id: number;
  url: string;
  secret: string;
  event_types: string[];
  created_at: Date;
}

export interface DeliveryLog {
  id: number;
  webhook_id: number;
  event_type: string;
  payload: object;
  status: string;
  response_status: number | null;
  response_body: string | null;
  attempt_count: number;
  next_retry_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
```

```ts
// src/utils/signature.ts
import crypto from 'crypto';

export function generateSignature(payload: object, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return `sha256=${hmac.digest('hex')}`;
}

export function verifySignature(payload: object, secret: string, signature: string): boolean {
  const expected = generateSignature(payload, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
```

```ts
// src/services/sender.ts
import fetch from 'node-fetch';
import { pool } from '../db.js';
import { generateSignature } from '../utils/signature.js';
import { logger } from '../logger.js';
import type { DeliveryLog } from '../types.js';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const TIMEOUT_MS = 10000;

export async function sendWebhook(log: DeliveryLog) {
  const webhookRes = await pool.query('SELECT * FROM webhooks WHERE id = $1', [log.webhook_id]);
  const webhook = webhookRes.rows[0];
  if (!webhook) {
    logger.warn({ logId: log.id }, 'Webhook not found');
    return;
  }

  logger.debug({ logId: log.id, url: webhook.url }, 'Starting webhook delivery');

  const signature = generateSignature(log.payload, webhook.secret);
  let lastError: Error | null = null;

  for (let attempt = log.attempt_count; attempt < MAX_RETRIES; attempt++) {
    logger.debug({ logId: log.id, attempt }, 'Webhook attempt');

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
          'X-Webhook-Id': String(log.id),
        },
        body: JSON.stringify(log.payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const responseBody = await response.text();

      if (response.ok) {
        logger.info({ logId: log.id, attempt, status: response.status }, 'Webhook delivered');
        await pool.query(
          `UPDATE delivery_logs 
           SET status = 'success', response_status = $1, response_body = $2, attempt_count = $3, updated_at = NOW()
           WHERE id = $4`,
          [response.status, responseBody, attempt + 1, log.id]
        );
        return;
      } else {
        logger.warn({ logId: log.id, attempt, status: response.status }, 'Webhook failed');
        lastError = new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      clearTimeout(timeout);
      logger.warn({ logId: log.id, attempt, error: String(err) }, 'Webhook error');
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000;
    const nextRetry = new Date(Date.now() + delay);
    await pool.query(
      `UPDATE delivery_logs 
       SET attempt_count = $1, next_retry_at = $2, updated_at = NOW()
       WHERE id = $3`,
      [attempt + 1, nextRetry, log.id]
    );

    await new Promise((r) => setTimeout(r, delay));
  }

  logger.error({ logId: log.id, error: lastError?.message }, 'Webhook dead letter');
  await pool.query(
    `UPDATE delivery_logs 
     SET status = 'failed', response_body = $1, updated_at = NOW()
     WHERE id = $2`,
    [lastError?.message || 'Unknown error', log.id]
  );
}
```

```ts
// src/routes/webhooks.ts
import { Router } from 'express';
import { pool } from '../db.js';
import { sendWebhook } from '../services/sender.js';
import type { Request, Response } from 'express';

const router = Router();

router.post('/webhooks', async (req: Request, res: Response) => {
  const { url, event_types, secret } = req.body;
  if (!url || !Array.isArray(event_types)) {
    res.status(400).json({ error: 'url and event_types are required' });
    return;
  }

  const result = await pool.query(
    `INSERT INTO webhooks (url, event_types, secret) VALUES ($1, $2, $3) RETURNING *`,
    [url, event_types, secret || '']
  );

  res.status(201).json({ webhook: result.rows[0] });
});

router.post('/events', async (req: Request, res: Response) => {
  const { event_type, payload } = req.body;
  if (!event_type || !payload) {
    res.status(400).json({ error: 'event_type and payload are required' });
    return;
  }

  const webhooks = await pool.query(
    `SELECT id FROM webhooks WHERE $1 = ANY(event_types)`,
    [event_type]
  );

  const logs = [];
  for (const webhook of webhooks.rows) {
    const logResult = await pool.query(
      `INSERT INTO delivery_logs (webhook_id, event_type, payload, status)
       VALUES ($1, $2, $3, 'pending') RETURNING *`,
      [webhook.id, event_type, JSON.stringify(payload)]
    );
    logs.push(logResult.rows[0]);
  }

  for (const log of logs) {
    sendWebhook(log).catch(console.error);
  }

  res.status(202).json({ queued: logs.length });
});

router.get('/webhooks/:id/logs', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const result = await pool.query(
    `SELECT * FROM delivery_logs WHERE webhook_id = $1 ORDER BY created_at DESC`,
    [id]
  );
  res.json({ logs: result.rows });
});

export default router;
```

## Why This Matters in Production

Without retries, transient failures become permanent data loss. Without backoff, retries DDoS the receiver. Without signatures, anyone can forge webhooks. Without idempotency, duplicate events corrupt receiver state. Without timeouts, requests hang forever. Without delivery logs, debugging is impossible.

## Pain → Solution Summary

| Version | Pain | Solution |
|---------|------|----------|
| v1 | Fire-and-forget | Basic webhook concept |
| v2 | Typos in event handling | TypeScript interfaces |
| v3 | No retries or backoff | Exponential backoff + AbortController |
| v4 | No visibility into delivery | Structured logging |
| v5 | Silent breakage when adding signatures | Vitest tests for empty secrets |
| v6 | CJS module resolution issues | ESM with NodeNext |
| v7 | No signature or idempotency | HMAC signing + idempotency keys |

## Run It

```bash
PORT=3000 NODE_ENV=production node dist/index.js
```
