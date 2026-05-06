# MD18 LMS — v4 Add Logging

## Goal
Track enrollments, quiz attempts, and certificate generation for audit.

## Changes from v3
- Add `pino` for structured JSON logging
- Log every enrollment, quiz submission, and certificate issuance
- Attach request IDs

## Logger Setup

### `src/utils/logger.ts`
```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

export const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      reqId: req.headers['x-request-id'] || crypto.randomUUID(),
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: Date.now() - start,
    });
  });
  next();
};
```

## Service Logging

### `src/services/enrollmentService.ts`
```typescript
import { logger } from '../utils/logger.js';

async enroll(userId: string, courseId: string) {
  logger.info({ userId, courseId }, 'Enrollment attempt');
  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) {
    logger.warn({ userId, courseId }, 'Duplicate enrollment rejected');
    throw new Error('Already enrolled');
  }
  // ...
}
```

## Benefits
- Enrollment disputes traceable by request ID
- Quiz attempt patterns observable
- Pino async keeps latency low

## Still Missing
- No automated tests
- No log rotation
