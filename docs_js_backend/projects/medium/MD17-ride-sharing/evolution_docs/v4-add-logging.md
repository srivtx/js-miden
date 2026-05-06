# MD17 Ride Sharing — v4 Add Logging

## Goal
Capture structured logs for fare disputes, driver arbitration, and system debugging.

## Changes from v3
- Add `pino` for JSON logging
- Log every ride request, acceptance, and completion
- Attach request IDs for distributed tracing
- Log surge pricing calculations with context

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

### `src/services/rideService.ts`
```typescript
import { logger } from '../utils/logger.js';

async requestRide(data: RequestRideInput) {
  const surgeMultiplier = await this.getSurgeMultiplier(data.pickupLat, data.pickupLng);
  logger.info({
    riderId: data.riderId,
    pickupLat: data.pickupLat,
    pickupLng: data.pickupLng,
    surgeMultiplier,
  }, 'Surge pricing calculated');

  const totalFare = (baseFare + distanceFare + timeFare) * surgeMultiplier;
  logger.info({ riderId: data.riderId, totalFare }, 'Ride requested');
  // ...
}
```

## Benefits
- Fare disputes are resolvable via timestamped log entries
- Surge pricing decisions are auditable
- Pino async logging keeps latency low

## Still Missing
- No tests asserting log output
- No log rotation
