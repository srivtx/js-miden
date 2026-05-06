# MD20 Logistics — v3 Add Validation

## Goal
Guard shipment creation and status updates against bad data.

## Changes from v2
- Add `express-validator`
- Validate weight, UUIDs, and status enums
- Add `src/middleware/validate.ts`

## Validation Middleware

### `src/middleware/validate.ts`
```typescript
import { body, validationResult } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';

export const validateShipment = [
  body('originId').isUUID(),
  body('destinationId').isUUID(),
  body('weight').isFloat({ min: 0.01 }),
  body('createdBy').isUUID(),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  },
];

export const validateStatusUpdate = [
  body('status').isIn(['CREATED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED']),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  },
];
```

## Route Update
```typescript
import { validateShipment } from '../middleware/validate.js';
router.post('/', validateShipment, async (req, res) => {
  const shipment = await shipmentService.createShipment(req.body);
  res.status(201).json({ data: shipment });
});
```

## Benefits
- Negative weight rejected at edge
- Invalid status values return 400
- Consistent error shape

## Still Missing
- Status update still not atomic with tracking
- No logging
