# MD19 Real Estate — v3 Add Validation

## Goal
Guard listing creation and tour scheduling against bad data.

## Changes from v2
- Add `express-validator`
- Validate price, beds, baths, lat/lng
- Add `src/middleware/validate.ts`

## Validation Middleware

### `src/middleware/validate.ts`
```typescript
import { body, validationResult } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';

export const validateListing = [
  body('address').trim().notEmpty(),
  body('city').trim().notEmpty(),
  body('state').trim().isLength({ min: 2, max: 2 }),
  body('zipCode').trim().matches(/^\d{5}(-\d{4})?$/),
  body('price').isFloat({ min: 0 }),
  body('beds').isInt({ min: 0 }),
  body('baths').isFloat({ min: 0 }),
  body('latitude').isFloat({ min: -90, max: 90 }),
  body('longitude').isFloat({ min: -180, max: 180 }),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  },
];
```

## Route Update
```typescript
import { validateListing } from '../middleware/validate.js';
router.post('/', validateListing, async (req, res) => {
  const listing = await listingService.create(req.body);
  res.status(201).json({ data: listing });
});
```

## Benefits
- Negative prices rejected at edge
- Invalid ZIP codes return 400
- Consistent error shape

## Still Missing
- Search still uses slow LIKE queries
- No logging
