# Billing Integration

## Overview
TeamTask Pro integrates with Stripe for subscription billing. The Auth Service handles webhook events to maintain subscription status.

## Plans

| Plan | Price | Projects | Users | Storage |
|------|-------|----------|-------|---------|
| Free | $0 | 3 | 5 | 100MB |
| Pro | $29/mo | Unlimited | 20 | 5GB |
| Enterprise | $99/mo | Unlimited | Unlimited | 50GB |

## Stripe Integration Flow

```
┌─────────┐    Create Checkout    ┌──────────┐
│ Client  │ ────────────────────► │  Stripe  │
└─────────┘                       └────┬─────┘
     ▲                                 │
     │        Checkout Complete        │
     └─────────────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │ Webhook Endpoint│
              │ /webhooks/stripe│
              └───────┬────────┘
                      │
                      ▼
              ┌───────────────┐
              │  Auth Service │
              │ Update Org    │
              │ Subscription  │
              └───────────────┘
```

## Webhook Events

### invoice.payment_succeeded
- Update organization subscription status to `active`
- Extend subscription period

### invoice.payment_failed
- Update status to `past_due`
- Send notification to organization owners

### customer.subscription.deleted
- Update status to `canceled`
- Restrict to free plan limits

## Implementation

```typescript
// Webhook handler
async stripeWebhook(req: Request, res: Response) {
  const event = stripe.webhooks.constructEvent(
    req.body,
    req.headers['stripe-signature'],
    process.env.STRIPE_WEBHOOK_SECRET
  );

  switch (event.type) {
    case 'invoice.payment_succeeded':
      await handlePaymentSuccess(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionCanceled(event.data.object);
      break;
  }

  res.json({ received: true });
}
```

## Security
- Webhook signature verified using Stripe secret
- Raw body preserved for signature verification
- Idempotency handled via event IDs
