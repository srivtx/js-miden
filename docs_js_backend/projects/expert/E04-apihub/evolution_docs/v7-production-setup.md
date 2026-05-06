# v7 — Production Setup

Your API marketplace works locally. But production marketplaces face unique challenges: payment processing reliability, API key rotation without downtime, webhook delivery guarantees, and fraud detection. A deploy can't break active developer integrations.

## Pain #1: Payment Processing Failures

```typescript
// billing/src/routes/invoices.ts
router.post('/charge', async (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_KEY!);
  const charge = await stripe.charges.create({
    amount: invoice.totalAmount * 100,
    currency: 'usd',
    customer: invoice.customerId,
  });
  // No idempotency key. Network blip retries the charge.
  // Developer is charged twice.
  // Refund requests flood support.
});
```

A network timeout causes the billing service to retry. The same invoice is charged twice. The developer's credit card statement shows two identical charges.

## Pain #2: API Key Rotation Downtime

```typescript
// auth/src/routes/keys.ts
app.post('/keys/rotate', async (req, res) => {
  const newKey = await generateApiKey(req.user.id);
  await deactivateOldKey(req.body.keyId);
  // Old key is deactivated immediately.
  // All in-flight requests with the old key fail with 401.
});
```

A developer rotates their API key. The old key is instantly invalidated. Their production servers, which cache the key for 5 minutes, start failing. Their service goes down.

## Pain #3: Webhook Delivery Failures

```typescript
// developer-portal/src/routes/webhooks.ts
app.post('/webhooks/deliver', async (req, res) => {
  for (const webhook of webhooks) {
    await fetch(webhook.url, {
      method: 'POST',
      body: JSON.stringify(req.body.event),
    });
    // No retry. No queue. If the developer's server is down, the event is lost.
  }
});
```

A developer's server is down for maintenance. A subscription cancellation event is lost. Their database shows an active subscription that was cancelled. They continue providing service for free.

## Pain #4: No Fraud Detection

```typescript
// gateway/src/middleware/ratelimit.ts
// Rate limiting only checks requests per second.
// A stolen API key makes 100 requests/second from 50 different IPs.
// Each IP is under the limit. The attack goes undetected.
```

A developer's API key is leaked on GitHub. An attacker uses it from 1000 IPs, each making 99 requests/second. The total is 99,000 requests/second. The gateway is overwhelmed.

## The Fix: Production Marketplace Architecture

### Idempotent Billing with Stripe

```typescript
// services/billing/src/payments/stripe.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_KEY!, { apiVersion: '2024-06-20' });

export async function chargeInvoice(invoice: Invoice): Promise<ChargeResult> {
  const idempotencyKey = `invoice-${invoice.id}-${invoice.status}`;
  
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(invoice.totalAmount * 100),
      currency: 'usd',
      customer: invoice.stripeCustomerId,
      metadata: { invoiceId: invoice.id },
    }, {
      idempotencyKey,
    });
    
    logger.info({ invoiceId: invoice.id, paymentIntentId: paymentIntent.id }, 'Payment initiated');
    
    return { success: true, paymentIntentId: paymentIntent.id };
  } catch (error: any) {
    logger.error({ invoiceId: invoice.id, error: error.message }, 'Payment failed');
    return { success: false, error: error.message };
  }
}
```

### Zero-Downtime Key Rotation

```typescript
// services/auth/src/routes/keys.ts
const KEY_GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes

app.post('/keys/rotate', async (req, res) => {
  const oldKey = await getApiKey(req.body.keyId);
  const newKey = await generateApiKey(req.user.id, oldKey.apiId);
  
  // Schedule old key deactivation
  await scheduleKeyDeactivation(oldKey.id, Date.now() + KEY_GRACE_PERIOD_MS);
  
  logger.info({
    oldKeyId: oldKey.id,
    newKeyId: newKey.id,
    deactivatesAt: new Date(Date.now() + KEY_GRACE_PERIOD_MS),
  }, 'Key rotated with grace period');
  
  res.json({
    newKey: newKey.key,
    oldKeyExpiresAt: Date.now() + KEY_GRACE_PERIOD_MS,
  });
});

// Background job deactivates expired keys
setInterval(async () => {
  const expiredKeys = await getExpiredKeys();
  for (const key of expiredKeys) {
    await deactivateKey(key.id);
    logger.info({ keyId: key.id }, 'Grace period expired, key deactivated');
  }
}, 60000);
```

### Reliable Webhook Delivery with Queue

```typescript
// services/developer-portal/src/queues/webhooks.ts
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const webhookQueue = new Queue('webhooks', { connection: redis });

export async function enqueueWebhook(
  developerId: string,
  event: WebhookEvent
) {
  const webhooks = await getDeveloperWebhooks(developerId);
  
  for (const webhook of webhooks) {
    await webhookQueue.add('deliver', {
      url: webhook.url,
      event,
      webhookId: webhook.id,
      attempts: 0,
    }, {
      attempts: 10,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
  }
}

const webhookWorker = new Worker('webhooks', async (job) => {
  const { url, event, webhookId } = job.data;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }
    
    logger.info({ webhookId, eventType: event.type }, 'Webhook delivered');
  } catch (error: any) {
    logger.warn({ webhookId, error: error.message, attempt: job.attemptsMade }, 'Webhook delivery failed');
    throw error; // Retry
  }
}, { connection: redis, concurrency: 10 });
```

### Fraud Detection with Anomaly Scoring

```typescript
// services/gateway/src/middleware/fraudDetection.ts
import { logger } from '@shared/utils/logger.js';

interface RequestFingerprint {
  apiKeyId: string;
  ip: string;
  userAgent: string;
  timestamp: number;
}

const anomalyScores = new Map<string, number>();

export async function checkFraud(req: Request, res: Response, next: NextFunction) {
  const apiKeyId = (req as any).apiKeyId;
  const ip = req.ip;
  const fingerprint: RequestFingerprint = {
    apiKeyId,
    ip,
    userAgent: req.headers['user-agent'] || 'unknown',
    timestamp: Date.now(),
  };
  
  // Check for distributed attack pattern
  const recentIps = await getRecentIpsForKey(apiKeyId, 60000); // Last minute
  const uniqueIps = new Set(recentIps).size;
  
  if (uniqueIps > 50) {
    logger.warn({ apiKeyId, uniqueIps }, 'Possible distributed attack detected');
    
    // Auto-block key
    await blockApiKey(apiKeyId, 'suspicious_activity');
    return res.status(403).json({ error: 'API key blocked due to suspicious activity' });
  }
  
  // Check for unusual user agent patterns
  const userAgents = await getRecentUserAgentsForKey(apiKeyId, 3600000);
  const uniqueUserAgents = new Set(userAgents).size;
  
  if (uniqueUserAgents > 20) {
    logger.warn({ apiKeyId, uniqueUserAgents }, 'Unusual user agent diversity');
    await flagKeyForReview(apiKeyId);
  }
  
  next();
}
```

## What Changed

1. **Payment safety** — Idempotency keys prevent double charges.
2. **Key rotation** — 5-minute grace period prevents instant breakage.
3. **Webhook reliability** — BullMQ with exponential backoff ensures delivery.
4. **Fraud detection** — Distributed attack patterns are auto-blocked.

## Production Checklist

- [ ] Idempotent payment processing
- [ ] Zero-downtime API key rotation
- [ ] Reliable webhook delivery with retry queue
- [ ] Fraud detection (distributed attacks, unusual patterns)
- [ ] Graceful shutdown with request draining
- [ ] Deep health checks (Stripe, Redis, DB connectivity)
- [ ] Rate limiting per key + per IP + per developer
- [ ] Usage aggregation with Redis transactions
- [ ] Invoice audit trail (immutable logs)
- [ ] GDPR-compliant data deletion

## The Evolution

| Stage | State |
|-------|-------|
| v1 | Simple API proxy |
| v2 | TypeScript types across 6 services |
| v3 | Validation at every service boundary |
| v4 | Structured logging with request tracing |
| v5 | Tests for billing, rate limiting, and auth |
| v6 | ESM for monorepo consistency |
| v7 | Production marketplace with payments, fraud detection, and reliability |

This is a production API marketplace. It handles billing, authentication, rate limiting, analytics, and developer experience. It started as a proxy. Now it's a RapidAPI-scale platform.
