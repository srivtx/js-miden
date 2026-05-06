# MD20 Logistics — v4 Add Logging

## Goal
Capture structured logs for shipment lifecycle, tracking events, and route calculations.

## Changes from v3
- Add `pino` for JSON logging
- Log every shipment creation, status change, and tracking event
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

### `src/services/shipmentService.ts`
```typescript
import { logger } from '../utils/logger.js';

async createShipment(data: CreateShipmentInput) {
  logger.info({ originId: data.originId, destinationId: data.destinationId }, 'Creating shipment');
  // ...
}

async updateStatus(id: string, status: string) {
  logger.info({ shipmentId: id, status }, 'Updating shipment status');
  // BUG: tracking event may still fail separately
  // ...
}
```

## Benefits
- Shipment lifecycle fully traceable
- Tracking inconsistencies detectable via log gaps
- Pino async keeps latency low

## Still Missing
- No automated tests
- No log rotation
