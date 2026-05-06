# v2 — Adding TypeScript

You just debugged why a charge of `19.99` resulted in a `$1,999.00` charge.

```js
const charge = await stripe.charges.create({
  amount: amount * 100,
  // ...
});
```

The user sent `"19.99"` (string). `"19.99" * 100` is `1999` in JavaScript string multiplication... wait, no, `"19.99" * 100` actually is `1999`. But what if they sent `"19,99"` (European format)? `"19,99" * 100` is `NaN`. Stripe rejected it. Or what if amount was `undefined`? `undefined * 100` is `NaN`.

TypeScript would have caught `amount: string` vs `amount: number`.

## The Fix: Types

```ts
interface ChargeRequest {
  amount: number; // in cents
  currency: string;
  token: string;
  idempotencyKey?: string;
}

interface ChargeResponse {
  status: 'success' | 'failed';
  chargeId?: string;
  error?: string;
}

app.post('/charge', async (req, res) => {
  const { amount, currency, token }: ChargeRequest = req.body;
  // amount is guaranteed to be number
  const charge = await stripe.charges.create({
    amount,
    currency,
    source: token,
  });
  // ...
});
```

Now `amount` is always a number. No string multiplication. No `NaN`.

## But Wait...

TypeScript doesn't add fallback providers. It doesn't prevent double-clicks. It just makes the data types correct.

**Next:** Let's add validation so invalid amounts and currencies are rejected.
