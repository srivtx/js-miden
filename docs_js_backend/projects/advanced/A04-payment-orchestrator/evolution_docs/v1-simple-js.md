# v1 — The Naive Payment (Pure JS)

You need to accept payments. You pick one provider. You charge cards.

```js
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_KEY);
const app = express();
app.use(express.json());

app.post('/charge', async (req, res) => {
  const { amount, currency, token } = req.body;

  const charge = await stripe.charges.create({
    amount: amount * 100,
    currency,
    source: token,
  });

  res.json({ status: 'success', chargeId: charge.id });
});

app.listen(3000);
```

You POST card details. You get a charge ID. Simple.

## Then the Pain Hits

**Provider downtime.** Stripe is down for 30 minutes. Your checkout is broken. Revenue stops.

**No fallback.** You have one provider. No backup. No retry.

**Duplicate charges.** A user clicks "Pay" twice. Two charges. Two shipments. Customer angry.

**No reconciliation.** Your database says $10,000 revenue. Stripe says $9,850. Where's the $150? You have no idea.

## The Realization

You need:
1. **Multiple providers** — Stripe, PayPal, Adyen
2. **Fallback logic** — if Stripe fails, try PayPal
3. **Idempotency** — same request = one charge
4. **Reconciliation** — match your ledger to provider ledgers

But payment orchestration is complex. The evolution will force you to split payment gateway from payment processing and build reconciliation as a separate service.
