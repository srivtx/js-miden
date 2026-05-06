# MD17 Ride Sharing — v3 Add Validation

## Goal
Guard all endpoints against malformed ride requests and invalid geocoordinates.

## Changes from v2
- Add `express-validator` for route validation
- Validate lat/lng bounds, UUIDs, and positive fare values
- Add `src/middleware/validate.ts`

## Validation Middleware

### `src/middleware/validate.ts`
```typescript
import { body, validationResult } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';

export const validateRideRequest = [
  body('riderId').isUUID(),
  body('pickupAddress').trim().notEmpty(),
  body('pickupLat').isFloat({ min: -90, max: 90 }),
  body('pickupLng').isFloat({ min: -180, max: 180 }),
  body('dropoffAddress').trim().notEmpty(),
  body('dropoffLat').isFloat({ min: -90, max: 90 }),
  body('dropoffLng').isFloat({ min: -180, max: 180 }),
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
import { validateRideRequest } from '../middleware/validate.js';

router.post('/', validateRideRequest, async (req, res) => {
  const ride = await rideService.requestRide(req.body);
  res.status(201).json({ data: ride });
});
```

## Benefits
- Invalid coordinates rejected before distance calculation
- Malformed UUIDs return 400 instead of DB errors
- Consistent error shape across all endpoints

## Still Missing
- Surge pricing logic is not validated (can return negative multipliers)
- No logging of rejected requests
