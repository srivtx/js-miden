# v3 — Adding Validation

A user just sent:

```json
{
  "amount": -100,
  "currency": "XYZ",
  "token": "tok_visa"
}
```

Your code charged `-100` cents. Stripe rejected it... or worse, some providers might accept it as a refund. The currency `XYZ` doesn't exist. The token might be a test token in production.

## The Fix: Schema Validation

You validate every charge request.

```ts
import { z } from 'zod';

const SUPPORTED_CURRENCIES = new Set(['usd', 'eur', 'gbp']);

const ChargeSchema = z.object({
  amount: z.number().int().positive().max(100000000), // max $1M
  currency: z.string().refine((c) => SUPPORTED_CURRENCIES.has(c.toLowerCase()), {
    message: 'Unsupported currency',
  }),
  token: z.string().min(10),
  idempotencyKey: z.string().uuid().optional(),
});

app.post('/charge', async (req, res) => {
  const parse = ChargeSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.errors });
  }
  // ...
});
```

Negative amounts are rejected. Fake currencies are rejected. Amounts over $1M are rejected (fraud protection).

## Token Environment Validation

You also ensure test tokens aren't used in production.

```ts
const isTestToken = (token: string) => token.startsWith('tok_test');

if (process.env.NODE_ENV === 'production' && isTestToken(token)) {
  return res.status(400).json({ error: 'Test token in production' });
}
```

## The Bug

You validate the request body, but what about the idempotency key format? A user sends `idempotencyKey: "pay-123"`. Your code uses it as a cache key. Later, they send `idempotencyKey: "pay-123 "` (with trailing space). It's treated as a different key. Duplicate charge.

**Fix:** Normalize and validate idempotency keys.

```ts
const IdempotencyKeySchema = z.string().uuid();
```

**Next:** Let's add logging so you can trace every charge attempt.
