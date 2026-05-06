# v4-add-logging

## Goal
Make cart operations observable without `console.log` noise.

## Changes
1. Replace `console.log` with `pino` structured logger.
2. Log every add/remove/merge with `cartId` and `durationMs`.
3. Redact `productName` in production (PII).

## Code

```ts
// src/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: { paths: ['productName', 'email'] },
});
```

```ts
// src/service.ts
import { logger } from './logger.js';

export function addToCart(data: AddToCartRequest): Cart {
  const start = performance.now();
  // ... logic
  logger.info({ cartId: cart.id, itemCount: cart.items.length, durationMs: performance.now() - start }, 'cart_add');
  return cart;
}
```

## Decisions
- `pino` because it is JSON-first and worker-thread safe.
- Use `performance.now()` for sub-millisecond accuracy inside a single process.

## Risks
- In-memory logger can lose logs on crash. Add transport (file/stdout) in v7.
