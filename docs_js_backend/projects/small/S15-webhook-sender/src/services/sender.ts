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

      const responseBody = await response.text();

      if (response.ok) {
        await pool.query(
          `UPDATE delivery_logs 
           SET status = 'success', response_status = $1, response_body = $2, attempt_count = $3, updated_at = NOW()
           WHERE id = $4`,
          [response.status, responseBody, attempt + 1, log.id]
        );
        return;
      } else {
        lastError = new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      clearTimeout(timeout);
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    // Exponential backoff with jitter
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

  // Dead letter: all retries exhausted
  await pool.query(
    `UPDATE delivery_logs 
     SET status = 'failed', response_body = $1, updated_at = NOW()
     WHERE id = $2`,
    [lastError?.message || 'Unknown error', log.id]
  );
}
