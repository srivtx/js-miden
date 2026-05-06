# MD16 Food Delivery — v3 Add Validation

## Goal
Reject invalid payloads before they hit business logic.

## Changes from v2
- Add `express-validator` (or `zod`) for request validation
- Add `src/middleware/validate.ts`
- Protect all POST / PATCH routes

## Validation Middleware

### `src/middleware/validate.ts`
```typescript
import { body, validationResult } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';

export const validateOrder = [
  body('customerId').isUUID(),
  body('restaurantId').isUUID(),
  body('items').isArray({ min: 1 }),
  body('items.*.menuId').isUUID(),
  body('items.*.quantity').isInt({ min: 1 }),
  body('address').trim().notEmpty(),
  body('latitude').isFloat({ min: -90, max: 90 }),
  body('longitude').isFloat({ min: -180, max: 180 }),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];
```

## Route Update
```typescript
import { validateOrder } from '../middleware/validate.js';

router.post('/', validateOrder, async (req, res) => {
  // Data is guaranteed to match shape
  const order = await orderService.createOrder(req.body);
  res.status(201).json({ data: order });
});
```

## Benefits
- No more `NaN` latitudes crashing downstream geolocation
- Empty `items` arrays rejected at the edge
- Consistent 400 responses across all endpoints

## Still Missing
- Validation layer does not enforce inventory rules (business rule, not schema rule)
- No logging of rejected requests
