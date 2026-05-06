# v3-add-validation

## Goal
Reject invalid cart operations before they touch the store.

## Changes
1. Add `zod` schema for `addToCart` body.
2. Validate `quantity > 0` and `price >= 0`.
3. Validate `cartId` format if provided.

## Code

```ts
// src/validation.ts
import { z } from 'zod';

export const addToCartSchema = z.object({
  cartId: z.string().uuid().optional(),
  productId: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
});

export const mergeSchema = z.object({
  guestCartId: z.string().uuid(),
  userCartId: z.string().uuid(),
});
```

```ts
// src/routes.ts
import { addToCartSchema } from './validation.js';

router.post('/add', (req, res) => {
  const parsed = addToCartSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
  }
  const cart = addToCart(parsed.data);
  res.json(cart);
});
```

## Decisions
- `zod` over `joi` — smaller bundle, better TypeScript inference.
- Coerce at the edge (routes), keep services pure.

## Risks
- UUID validation on `cartId` is premature if we still generate sequential IDs. Must fix ID generation first.
