# Webhook Security

## The Problem
Your server exposes a public endpoint (`/webhooks/stripe`) that Stripe calls when events happen (payment succeeded, subscription cancelled, etc.). An attacker could forge these requests.

**Solution**: Verify the request using **HMAC-SHA256** with a shared secret (Stripe's webhook signing secret).

## HMAC Verification: Step-by-Step

### Step 1: Stripe Signs the Payload

When Stripe sends a webhook, it computes:

```
signature = HMAC_SHA256(webhook_secret, timestamp + "." + payload)
```

It sends the signature in the `Stripe-Signature` header:

```
Stripe-Signature: t=1492774577,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
```

### Step 2: Your Server Reconstructs the Signed Payload

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

function verifyStripeWebhook(
  payload: string,           // raw request body (not parsed!)
  signatureHeader: string,   // Stripe-Signature header
  secret: string             // webhook signing secret (whsec_...)
): boolean {
  // Parse the header
  const elements = signatureHeader.split(',');
  const signatureMap = new Map<string, string>();
  for (const element of elements) {
    const [key, value] = element.split('=');
    signatureMap.set(key.trim(), value.trim());
  }

  const timestamp = signatureMap.get('t');
  const signature = signatureMap.get('v1');

  if (!timestamp || !signature) return false;

  // Step 3: Check timestamp (prevent replay attacks)
  const now = Math.floor(Date.now() / 1000);
  if (now - parseInt(timestamp) > 300) { // 5 minute tolerance
    return false;
  }

  // Step 4: Reconstruct the signed payload
  const signedPayload = `${timestamp}.${payload}`;

  // Step 5: Compute HMAC
  const expectedSignature = createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // Step 6: Constant-time comparison
  const expectedBuf = Buffer.from(expectedSignature, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');

  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
```

### Step 7: Full Express Handler

```typescript
import express from 'express';
import Stripe from 'stripe';

const app = express();

// IMPORTANT: Use raw body parser for webhooks, NOT JSON parser
app.post('/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const payload = req.body as Buffer;
    const sig = req.headers['stripe-signature'] as string;
    const secret = process.env.STRIPE_WEBHOOK_SECRET!;

    if (!verifyStripeWebhook(payload.toString(), sig, secret)) {
      return res.status(400).send('Invalid signature');
    }

    const event = JSON.parse(payload.toString()) as Stripe.Event;

    // Process event
    switch (event.type) {
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object as Stripe.Subscription);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).send('OK');
  }
);
```

## Why `timingSafeEqual`?

A standard string comparison (`===`) returns `false` as soon as a mismatch is found. An attacker can measure the time taken and guess the signature byte-by-byte.

```
Standard comparison: "abc..." vs "xyz..."
  a vs x → mismatch at index 0 → returns immediately (fast)
  a vs a → match → check index 1
  b vs y → mismatch at index 1 → returns (slower)

Timing attack: attacker learns signature length and first byte by measuring time.
```

`timingSafeEqual` always takes the same amount of time regardless of where the mismatch occurs.

## Webhook Best Practices

| Practice | Implementation |
|---|---|
| **Verify signature** | HMAC-SHA256 with shared secret |
| **Check timestamp** | Reject events > 5 minutes old |
| **Use raw body** | Do not parse JSON before verification |
| **Idempotency** | Store `event.id` in DB; skip if already processed |
| **Return 200 quickly** | Process event asynchronously to avoid timeouts |
| **Retry logic** | Stripe retries on 4xx/5xx; handle gracefully |

## Sequence Diagram: Secure Webhook Flow

```
Stripe          Your Server          Redis/DB          Worker
  │                 │                   │                │
  │──POST webhook──▶│                   │                │
  │  + Signature    │                   │                │
  │                 │                   │                │
  │                 │──verify HMAC─────▶│                │
  │                 │◀──valid──────────│                │
  │                 │                   │                │
  │                 │──check idempotency key─────────────▶│
  │                 │◀──not seen────────│                │
  │                 │                   │                │
  │                 │──queue job─────────────────────────▶│
  │                 │                   │                │
  │◀──200 OK────────│                   │                │
  │                 │                   │                │
  │                 │                   │◀──process job──│
  │                 │                   │                │
  │                 │                   │──update DB────▶│
```

## OWASP Reference

> "Verify webhook signatures using a shared secret and HMAC. Use constant-time comparison to prevent timing attacks." — OWASP Webhook Security Guidelines

> "Treat webhooks as untrusted input. Validate the signature before parsing the payload." — OWASP Input Validation Cheat Sheet
