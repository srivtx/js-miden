# MD06 Billing Engine — v2 Add TypeScript

> **Motto**: Types are cheap; chargebacks are expensive.

## What Changed

Migrated from raw Node.js HTTP to Express + TypeScript. Introduced interfaces for `ChargeRequest`, `StripeCustomer`, and `PaymentIntentResponse`. Added `tsconfig.json` and build scripts.

## Why

- **Stripe objects are large**: Autocomplete on `paymentIntent.client_secret` prevents typos
- **Refactoring safety**: Renaming `amount` to `amountCents` catches all call sites
- **Team velocity**: New engineers understand the data model without reading runtime code

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│  Express + TS   │─────▶│     Stripe      │
│  (Checkout) │◀─────│  (typed DTOs)   │◀─────│   API           │
└─────────────┘      └─────────────────┘      └─────────────────┘
```

## Code

```typescript
// src/types.ts
export interface ChargeRequest {
  amount: number;        // in cents, > 0
  currency: string;      // ISO 4217
  customerEmail?: string;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  id: string;
  status: string;
}

// src/server.ts
import express, { Request, Response } from 'express';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const app = express();
app.use(express.json());

app.post('/charge', async (req: Request, res: Response) => {
  const { amount, currency, customerEmail } = req.body as ChargeRequest;

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    receipt_email: customerEmail,
  });

  const response: PaymentIntentResponse = {
    clientSecret: paymentIntent.client_secret!,
    id: paymentIntent.id,
    status: paymentIntent.status,
  };

  res.json(response);
});

app.listen(3000, () => console.log('Billing v2 on :3000'));
```

## Decisions

**Option A: Inline types in handler**
- Pros: Fast to write
- Cons: No reuse, diverges across routes

**Option B: Shared `types.ts` file**
- Pros: Single source of truth
- Cons: Slight boilerplate

**Chosen: B** — we already have two routes (charge, refund) that share `PaymentIntentResponse`.

## Problems We Accepted

- Still no runtime validation — a malformed body passes TypeScript at build time but fails at runtime
- Still no idempotency — retries create duplicates
- Still no structured logging

## Checklist

- [ ] `tsconfig.json` has `strict: true`
- [ ] Stripe API version is pinned (`2023-10-16`)
- [ ] All route handlers use explicit `Request` / `Response` types
- [ ] No `any` in the charge/refund flow

## Next Step

Add runtime validation so bad requests fail before they reach Stripe.
