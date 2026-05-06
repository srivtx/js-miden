# S15 Webhook Sender — v2 Add TypeScript

## The Bug: Types Catch YOUR Bugs

You add a retry loop:

```js
for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
  const response = await fetch(webhook.url, { ... });
  if (response.ok) break;
  await new Promise(r => setTimeout(r, 1000));
}
```

**The bug:** `webhook.url` might be `undefined` if the webhook registration was malformed. `fetch(undefined)` throws a `TypeError`. Your loop catches it and retries, but the error is unrecoverable.

Another bug: you treat `event_types` as an array but it's a string:

```js
webhooks.filter(w => w.event_types.includes(event.type)); // "order.created".includes("order") — wrong
```

TypeScript would flag `event_types` as `string[]`.

## The Fix: Add TypeScript

```ts
// types.ts
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
// routes/webhooks.ts
import { Router } from 'express';
import { pool } from '../db.js';
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

  res.status(202).json({ queued: logs.length });
});

export default router;
```

Now `tsc` errors on:
```
routes/webhooks.ts:8:28 - error TS2345: Argument of type 'string' is not assignable to parameter of type 'string[]'.
```

## But TypeScript Doesn't Catch Everything

TypeScript validates **compile-time** shapes, not **runtime** reliability. A client can still:
- Fire and forget without awaiting
- Retry immediately without backoff
- Skip delivery logging
- Send unsigned payloads

We need retry logic and backoff.

> **Lesson:** TypeScript eliminates typos and wrong shapes. But runtime reliability requires proper retry and backoff strategies.

## What v3 Fixes

Retry with exponential backoff. Make webhooks reliable.
