# MD16 Food Delivery — v4 Add Logging

## Goal
Add structured, queryable logs for debugging and audit trails.

## Changes from v3
- Add `pino` (or `winston`) for JSON logging
- Log every incoming request with request ID
- Log driver assignments and status transitions
- Separate error logs from access logs

## Logger Setup

### `src/utils/logger.ts`
```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
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

### `src/services/orderService.ts`
```typescript
import { logger } from '../utils/logger.js';

async assignDriver(orderId: string, driverId: string) {
  logger.info({ orderId, driverId }, 'Assigning driver');
  try {
    const result = await prisma.order.updateMany({
      where: { id: orderId, driverId: null },
      data: { driverId, status: 'PICKED_UP' },
    });
    if (result.count === 0) {
      logger.warn({ orderId, driverId }, 'Driver assignment failed: already assigned');
      throw new Error('Order already assigned');
    }
    logger.info({ orderId, driverId }, 'Driver assigned successfully');
    return result;
  } catch (err) {
    logger.error({ err, orderId, driverId }, 'Unexpected error during driver assignment');
    throw err;
  }
}
```

## Benefits
- `LOG_LEVEL=debug` reveals full request payloads during incidents
- Pino’s async logging does not block the event loop
- ELK / Datadog can ingest JSON logs natively

## Still Missing
- No automated tests asserting log lines
- No log rotation in production
