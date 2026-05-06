# S15 Webhook Sender — v4 Add Logging

## The Bug: Production Visibility Crisis

You deploy v3. Support ticket arrives: *"We didn't get the webhook."*

You check the code. It looks correct. You have zero visibility into:

- Was the webhook queued?
- How many retries were attempted?
- What was the response status?
- Did the payload match?

```ts
// Without logging — silent failure
for (const log of logs) {
  sendWebhook(log).catch(console.error);
}
```

## The Fix: Structured Logging

```ts
// services/sender.ts
import { logger } from '../logger.js';

export async function sendWebhook(log: DeliveryLog) {
  const webhookRes = await pool.query('SELECT * FROM webhooks WHERE id = $1', [log.webhook_id]);
  const webhook = webhookRes.rows[0];
  if (!webhook) {
    logger.warn({ logId: log.id }, 'Webhook not found');
    return;
  }

  logger.debug({ logId: log.id, url: webhook.url }, 'Starting webhook delivery');

  let lastError: Error | null = null;
  for (let attempt = log.attempt_count; attempt < MAX_RETRIES; attempt++) {
    logger.debug({ logId: log.id, attempt }, 'Webhook attempt');

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

Now your logs tell the story:
```json
{"level":"info","logId":42,"attempt":1,"status":200,"msg":"Webhook delivered"}
{"level":"warn","logId":43,"attempt":2,"status":502,"msg":"Webhook failed"}
{"level":"error","logId":43,"error":"HTTP 502","msg":"Webhook dead letter"}
```

Wait — the payload has no signature. The receiver can't verify authenticity. The log reveals the missing HMAC bug.

## The Pain That Remains

You add HMAC signing but forget to handle the case where `secret` is empty. Your test with a secret passes, but the empty secret case generates an invalid signature. No test caught it.

## What v5 Fixes

Testing. Silent breakage when adding features is unacceptable.
