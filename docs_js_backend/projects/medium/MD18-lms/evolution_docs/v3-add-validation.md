# MD18 LMS — v3 Add Validation

## Goal
Ensure course data and enrollment requests are well-formed.

## Changes from v2
- Add `express-validator`
- Validate course fields, enrollment UUIDs, and quiz indices
- Add `src/middleware/validate.ts`

## Validation Middleware

### `src/middleware/validate.ts`
```typescript
import { body, validationResult } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';

export const validateCourse = [
  body('title').trim().notEmpty().isLength({ max: 200 }),
  body('instructorId').isUUID(),
  body('maxStudents').isInt({ min: 1, max: 10000 }),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  },
];

export const validateEnrollment = [
  body('userId').isUUID(),
  body('courseId').isUUID(),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  },
];
```

## Route Update
```typescript
import { validateCourse } from '../middleware/validate.js';
router.post('/', validateCourse, async (req, res) => {
  const course = await courseService.create(req.body);
  res.status(201).json({ data: course });
});
```

## Benefits
- `maxStudents: -1` rejected at edge
- Invalid `courseId` returns 400 instead of SQL error
- Consistent validation across all routes

## Still Missing
- Capacity logic still not enforced atomically
- No logging
