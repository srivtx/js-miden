# MD19 Real Estate — v4 Add Logging

## Goal
Capture structured logs for search queries, tour bookings, and mortgage calculations.

## Changes from v3
- Add `pino` for JSON logging
- Log every search with filters and result count
- Log tour scheduling attempts

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

### `src/services/searchService.ts`
```typescript
import { logger } from '../utils/logger.js';

async search(filters: SearchFilters) {
  const results = await db.all('SELECT * FROM listings WHERE status = ?', ['ACTIVE']);
  logger.info({ filters, count: results.length }, 'Search executed');
  return results;
}
```

## Benefits
- Search performance traceable by filter complexity
- Tour booking disputes resolvable via logs
- Pino async keeps latency low

## Still Missing
- No automated tests
- No log rotation
