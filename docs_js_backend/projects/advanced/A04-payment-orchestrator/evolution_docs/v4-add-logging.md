# v4 — Adding Logging

A customer emails: "I was charged twice." You check the server. There's no evidence of either charge. The logs are in console.log, scattered across 3 server instances, and one instance crashed. You're blind.

## The Fix: Structured Logging

You log every payment attempt with full context.

```ts
import pino from 'pino';
const logger = pino();

app.post('/charge', async (req, res) => {
  const { amount, currency, token, idempotencyKey } = req.body;

  logger.info({
    amount,
    currency,
    tokenPrefix: token.slice(0, 4),
    idempotencyKey,
  }, 'Charge attempt started');

  try {
    const charge = await stripe.charges.create({
      amount,
      currency,
      source: token,
    }, {
      idempotencyKey,
    });

    logger.info({
      chargeId: charge.id,
      amount,
      currency,
      status: charge.status,
    }, 'Charge succeeded');

    res.json({ status: 'success', chargeId: charge.id });
  } catch (err) {
    logger.error({
      amount,
      currency,
      error: (err as Error).message,
      code: (err as any).code,
    }, 'Charge failed');

    res.status(502).json({ status: 'failed', error: (err as Error).message });
  }
});
```

Now you can trace: attempt started → provider called → success/failure.

## Why This Matters

Without logs, payment disputes are unwinnable. With structured logs, you can prove exactly what happened for any charge ID.

**Next:** Let's write tests so payment invariants hold as you add providers.
