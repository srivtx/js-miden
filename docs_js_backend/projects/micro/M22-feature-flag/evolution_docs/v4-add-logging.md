# v4: Add Logging — Feature Flag Service

## The Pain

A user reports: "I saw the new checkout flow yesterday, but today it's gone." You check the code. The flag is `enabled: true` with `rolloutPercentage: 50`. You have no idea whether that user was in the 50% or not. You have no logs. You are blind.

You ask the user to clear cookies and try again. They do. It works. You don't know why. This is not engineering — it is guesswork.

## The Solution

Add structured logging with `pino`. Log every flag evaluation with context.

## Before (No Logs)

```typescript
// src/feature-flag.ts
isEnabled(flagName: string, userId?: string): boolean {
  const flag = this.flags.get(flagName);
  if (!flag) return false;
  if (!flag.enabled) return false;
  if (userId && flag.userIds?.includes(userId)) return true;
  if (flag.rolloutPercentage > 0) {
    const randomValue = Math.random() * 100;
    return randomValue <= flag.rolloutPercentage;
  }
  return true;
}
```

## After (With Logging)

```typescript
// src/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
```

```typescript
// src/feature-flag.ts
import { logger } from './logger.js';

isEnabled(flagName: string, userId?: string): boolean {
  const flag = this.flags.get(flagName);
  if (!flag) {
    logger.debug({ flag: flagName, userId }, 'Flag not found');
    return false;
  }
  if (!flag.enabled) {
    logger.debug({ flag: flagName, userId }, 'Flag disabled');
    return false;
  }
  if (userId && flag.userIds?.includes(userId)) {
    logger.info({ flag: flagName, userId }, 'User override enabled');
    return true;
  }
  if (flag.rolloutPercentage > 0) {
    const randomValue = Math.random() * 100;
    const enabled = randomValue <= flag.rolloutPercentage;
    logger.debug({ flag: flagName, userId, randomValue, enabled }, 'Rollout evaluated');
    return enabled;
  }
  logger.debug({ flag: flagName, userId }, 'Flag enabled by default');
  return true;
}
```

## What the Logs Look Like

```json
{"level":30,"time":1715200000000,"flag":"new-checkout","userId":"user-123","msg":"User override enabled"}
{"level":20,"time":1715200001000,"flag":"dark-mode","userId":"user-456","randomValue":23.4,"enabled":true,"msg":"Rollout evaluated"}
{"level":20,"time":1715200002000,"flag":"dark-mode","userId":"user-456","randomValue":67.8,"enabled":false,"msg":"Rollout evaluated"}
```

Wait — the same user got `enabled: true` then `enabled: false`! The logs reveal the `Math.random()` bug immediately.

## Why Logging Matters

- **Audit**: Prove whether a user saw a feature
- **Debug**: Trace the exact decision path for every flag check
- **Alert**: Log `warn` when a flag is checked but missing (typo?)
- **Performance**: Log `debug` timing for slow hash computations

Without logs, you are guessing. With logs, you are observing.
