# Payment Processing

## The Payment Flow

```
Customer          Frontend          Billing API          Stripe
   │                 │                   │                  │
   │──enter card───▶│                   │                  │
   │                 │──tokenize card───▶│                  │
   │                 │                   │──create token───▶│
   │                 │◀──token───────────│◀──token──────────│
   │                 │                   │                  │
   │──subscribe────▶│                   │                  │
   │                 │──create sub──────▶│                  │
   │                 │                   │──charge/attach──▶│
   │                 │                   │◀──success───────│
   │                 │◀──confirmation────│                  │
   │◀──success───────│                   │                  │
```

**Critical**: The frontend sends card data **directly to Stripe** (via Stripe.js), not to your server. Your server only receives a **token** or **payment method ID**.

## Tokenization

```javascript
// Frontend (Stripe.js)
const stripe = Stripe('pk_test_...');
const { token, error } = await stripe.createToken(cardElement);

// Send token to backend
const response = await fetch('/api/subscriptions', {
  method: 'POST',
  body: JSON.stringify({ plan: 'pro', token: token.id }),
});
```

```typescript
// Backend
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

export async function createSubscription(userId: string, plan: string, token: string) {
  const customer = await stripe.customers.create({
    source: token, // attaches the card
    metadata: { userId },
  });

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: PLAN_PRICES[plan] }],
  });

  await db.subscription.create({
    data: {
      userId,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      plan,
      status: subscription.status,
    },
  });

  return subscription;
}
```

## Handling Payment Failures

```typescript
export async function chargeInvoice(invoiceId: string) {
  try {
    const invoice = await stripe.invoices.pay(invoiceId);
    return { success: true, invoice };
  } catch (error: any) {
    if (error.code === 'card_declined') {
      await handleDecline(invoiceId, error.decline_code);
      return { success: false, reason: 'card_declined' };
    }
    if (error.code === 'insufficient_funds') {
      await handleDecline(invoiceId, 'insufficient_funds');
      return { success: false, reason: 'insufficient_funds' };
    }
    // Unexpected error: retry with backoff
    throw error;
  }
}
```

## Common Decline Codes

| Code | Meaning | Action |
|---|---|---|
| `card_declined` | Generic decline | Ask customer to use another card |
| `insufficient_funds` | Not enough money | Retry in 3 days (dunning) |
| `expired_card` | Card expired | Prompt customer to update card |
| `incorrect_cvc` | Wrong CVV | Ask customer to retry |
| `processing_error` | Gateway error | Retry immediately (idempotent) |
| `issuer_not_available` | Bank offline | Retry in 1 hour |

## PCI-DSS Requirement: Never Store Card Data

> "Do not store the full contents of any track from the magnetic stripe ... or the equivalent data on a chip." — PCI-DSS Requirement 3.2

| Data Element | Storage Allowed | Notes |
|---|---|---|
| Primary Account Number (PAN) | No (unless encrypted per PCI) | Use tokens |
| CVV / CVC | **No** | Never store, even encrypted |
| PIN | **No** | Never store |
| Cardholder name | Yes | Needed for invoices |
| Expiration date | Yes | Needed for reminders |
| Token | Yes | This is what you store |

## 3D Secure (Strong Customer Authentication)

For EU customers, **PSD2** requires 3D Secure for online payments:

```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: 2000,
  currency: 'eur',
  customer: customer.id,
  payment_method: paymentMethodId,
  confirm: true,
  off_session: true, // for recurring
});

if (paymentIntent.status === 'requires_action') {
  // Customer must complete 3D Secure on frontend
  return { requiresAction: true, clientSecret: paymentIntent.client_secret };
}
```

## OWASP Reference

> "Never log sensitive payment data (PAN, CVV). Mask PANs in logs (show only last 4 digits)." — OWASP Payment Card Industry Cheat Sheet

> "Use a trusted payment gateway (Stripe, Adyen, Braintree) instead of handling card data yourself. This reduces PCI scope to SAQ A." — PCI-DSS SAQ A
