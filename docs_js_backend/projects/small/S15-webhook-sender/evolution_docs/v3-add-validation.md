# S15 Webhook Sender — v3 Add Validation

## The Bug: Validation Catches USER Bugs

Without validation, your API accepts anything:

```bash
curl -X POST http://localhost:3000/webhooks -H "Content-Type: application/json" -d '{"url": "not-a-url", "event_types": "string"}'
curl -X POST http://localhost:3000/events -H "Content-Type: application/json" -d '{"event_type": "order.created"}'
```

Your endpoints:
- Accept `url: "not-a-url"` → fetch throws, unhandled
- Accept `event_types: "string"` instead of array → no webhooks match
- Send without payload → receiver gets `undefined`
- Retry immediately on 502 → DDoS the receiver

## The Fix: Retries with Exponential Backoff

```ts
// services/sender.ts
import fetch from 'node-fetch';
import { pool } from '../db.js';
import type { DeliveryLog } from '../types.js';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const TIMEOUT_MS = 10000;

export async function sendWebhook(log: DeliveryLog) {
  const webhookRes = await pool.query('SELECT * FROM webhooks WHERE id = $1', [log.webhook_id]);
  const webhook = webhookRes.rows[0];
  if (!webhook) return;

  let lastError: Error | null = null;
  for (let attempt = log.attempt_count; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

```ts
// routes/webhooks.ts
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

  // Send asynchronously
  for (const log of logs) {
    sendWebhook(log).catch(console.error);
  }

  res.status(202).json({ queued: logs.length });
});
```

**What this prevents:**
- Fire-and-forget failures
- Immediate retry storms
- Infinite retries via `MAX_RETRIES`
- Hanging requests via `AbortController`

## The Pain That Remains

You deploy to production. A support ticket arrives: *"We received a webhook but we can't verify it came from you."* You have no payload signing. Anyone can forge a webhook. You have zero visibility into:
- Was the payload tampered with?
- Did the receiver verify the signature?
- What was the exact payload sent?

## What v4 Fixes

Logging. Production without logs is flying blind.
