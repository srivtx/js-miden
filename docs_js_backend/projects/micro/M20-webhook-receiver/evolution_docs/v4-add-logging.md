# M20 Webhook Receiver — v4 Add Logging

## The Bug: Production Visibility Crisis

Your webhook receiver handles 1,000 webhooks/day. You have no visibility into:
- Which webhooks fail signature verification (and why)
- How many are replays or duplicates
- How long processing takes
- Whether async jobs complete successfully

```ts
// Without logging — silent failures
app.post('/webhook/:provider', async (req, res) => {
  const verified = verifyWebhook(provider, payload, headers);
  if (!verified.valid) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }
  processEventAsync(provider, eventId, payload, headers);
  res.status(202).json({ success: true });
});
```

A support ticket: *"GitHub says our webhook is failing."* You check your app... it returns 202. GitHub sees 401. You have no logs showing the signature mismatch.

## The Fix: Structured Logging

```ts
import { logger } from './logger.js';

app.post('/webhook/:provider', async (req: Request, res: Response) => {
  const provider = req.params.provider;
  const requestId = crypto.randomUUID();

  logger.info({ requestId, provider }, 'Webhook received');

  if (!isValidProvider(provider)) {
    logger.warn({ requestId, provider }, 'Unknown provider');
    res.status(400).json({ error: 'Unknown provider' });
    return;
  }

  const payload = req.body as Buffer;
  const verified = verifyWebhook(provider, payload, req.headers);

  if (!verified.valid) {
    logger.warn({
      requestId,
      provider,
      reason: verified.reason,
    }, 'Webhook signature verification failed');
    res.status(401).json({ error: 'Invalid signature', reason: verified.reason });
    return;
  }

  if (verified.tooOld) {
    logger.warn({ requestId, provider, eventId: verified.eventId }, 'Webhook replay detected');
    res.status(401).json({ error: 'Webhook too old - possible replay attack' });
    return;
  }

  if (verified.duplicate) {
    logger.info({ requestId, provider, eventId: verified.eventId }, 'Duplicate webhook ignored');
    res.status(200).json({ success: true, message: 'Already processed' });
    return;
  }

  const eventId = verified.eventId;
  logger.info({ requestId, provider, eventId }, 'Webhook accepted, queuing for processing');

  processEventAsync(provider, eventId, payload, req.headers);

  res.status(202).json({
    success: true,
    provider,
    eventId,
    processed: false,
    queuedAt: new Date().toISOString(),
  });
});
```

Now logs tell the full story:
```json
{"level":"warn","requestId":"abc","provider":"github","reason":"Signature mismatch","msg":"Webhook signature verification failed"}
```

**Ah.** The secret in production doesn't match the one GitHub is using. The log makes it obvious.

Another scenario:
```json
{"level":"warn","requestId":"def","provider":"stripe","eventId":"evt_123","msg":"Webhook replay detected"}
```

An attacker (or a misconfigured retry loop) is sending old Stripe events. Blocked.

## The Pain That Remains

You update `verifyWebhook` to support a new provider. You accidentally break GitHub signature parsing. Your tests? None cover GitHub's `x-hub-signature-256` header format.

## What v5 Fixes

Testing. Every provider, every failure mode, every security boundary needs a test.
