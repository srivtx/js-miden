# v3-add-validation.md — "Users send garbage data"

## The Bug

Your counter API accepts an amount to increment by:

```ts
app.post('/increment', async (req: Request, res: Response) => {
  const amount = req.body.amount;
  const current = await getCount();
  const next = current + amount;
  await setCount(next);
  res.json({ count: next });
});
```

A user sends:

```json
{ "amount": -100 }
```

The counter goes from 500 to 400. You just allowed users to decrement the global counter. A competitor discovers this and sets your "total users" counter to 0.

Another user sends:

```json
{ "amount": "not-a-number" }
```

`current + "not-a-number"` is `"500not-a-number"`. You store that string in Redis. The next `getCount` returns `"500not-a-number"`. `parseInt` returns `500`. The extra text is silently ignored. Data is corrupted.

## The 3am Page, Redux

Someone sends:

```json
{ "amount": 1.5 }
```

You store `501.5`. The frontend expects an integer and renders `501.5 users`. The product manager asks why you have half a user.

## Adding Zod Validation

```bash
npm install zod
```

```ts
// src/validation.ts
import { z } from 'zod';

export const incrementSchema = z.object({
  amount: z.number().int().min(1).max(1000).default(1),
}).strict();

export type IncrementInput = z.infer<typeof incrementSchema>;
```

```ts
// src/index.ts
import { incrementSchema } from './validation.js';

app.post('/increment', async (req: Request, res: Response) => {
  const result = incrementSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      valid: false,
      errors: result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const count = await increment(result.data.amount);
  res.json({ count });
});
```

Now:

- `{ "amount": -100 }` → 400, `"Number must be greater than or equal to 1"`
- `{ "amount": "not-a-number" }` → 400, `"Expected number, received string"`
- `{ "amount": 1.5 }` → 400, `"Expected integer, received float"`
- `{}` → defaults to `amount: 1`

## Why `.strict()`?

Without `.strict()`, a user could send `{ amount: 1, reset: true }`. You ignore `reset` today, but a future developer might use it. Strict mode rejects unknown fields so your API contract is explicit.

## What Changed

- Added Zod schema for the increment body
- `.int()` ensures whole numbers
- `.min(1)` prevents negative increments
- `.max(1000)` prevents absurdly large increments
- `default(1)` makes the API easy to use

## What We Still Need

Validation stops bad data. But when Redis is down, or the network hiccups, or a race condition causes lost increments, we need to know. We need visibility into every request.

For that, we need structured logging.
