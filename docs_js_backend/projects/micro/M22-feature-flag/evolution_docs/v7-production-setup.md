# v7: Production Setup — Feature Flag Service

## The Journey

We started with hardcoded booleans, layered in types, validation, logging, tests, and ESM. Now we land at production-grade feature flags.

## What v7 Adds

- **Environment-aware config**: Flags load from `FLAGS_CONFIG_PATH`
- **Consistent hashing**: Same user always gets the same result
- **Rollout strategies**: Percentage-based, user-list, and all/none
- **Structured logging**: Every flag check is traceable
- **Graceful degradation**: Missing config file → safe defaults

## The Final Code

```typescript
// src/feature-flag.ts
import { createHash } from 'crypto';
import { logger } from './logger.js';

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  rolloutPercentage: number;
  userIds?: string[];
}

export class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();

  loadFromEnv(): void {
    const configPath = process.env.FLAGS_CONFIG_PATH;
    if (!configPath) {
      logger.warn('FLAGS_CONFIG_PATH not set, using in-memory flags');
      return;
    }
    // Load from file, validate schema, set flags
  }

  setFlag(flag: FeatureFlag): void {
    this.flags.set(flag.name, flag);
    logger.info({ flag: flag.name }, 'Flag configured');
  }

  isEnabled(flagName: string, userId?: string): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) {
      logger.debug({ flag: flagName }, 'Flag not found, returning false');
      return false;
    }
    if (!flag.enabled) return false;

    if (userId && flag.userIds?.includes(userId)) {
      logger.info({ flag: flagName, userId }, 'User override enabled');
      return true;
    }

    if (flag.rolloutPercentage > 0 && userId) {
      const hash = createHash('sha256').update(userId + flagName).digest('hex');
      const bucket = parseInt(hash.slice(0, 8), 16) % 100;
      const enabled = bucket < flag.rolloutPercentage;
      logger.debug({ flag: flagName, userId, bucket, enabled }, 'Rollout evaluated');
      return enabled;
    }

    return true;
  }

  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }
}
```

## Why This Matters in Production

Without consistent hashing, a user with `dark-mode` enabled on Monday sees it disabled on Tuesday. That destroys trust. Without env-based config, every flag change requires a code deploy. Without logging, you cannot audit who saw what.

## Pain → Solution Summary

| Version | Pain | Solution |
|---------|------|----------|
| v1 | Hardcoded booleans require deploys to change | In-memory flag map |
| v2 | `any` types hide bugs | `FeatureFlag` interface |
| v3 | Invalid percentages (150%) crash math | Joi/Zod validation |
| v4 | No visibility into flag decisions | Structured `pino` logging |
| v5 | Consistent hashing breaks silently | Jest tests with seeded users |
| v6 | CJS module chaos | ESM with `"type": "module"` |
| v7 | Ghost flags, random rollouts, no audit | Consistent hashing + env config + logging |

## Run It

```bash
FLAGS_CONFIG_PATH=./flags.json NODE_ENV=production node dist/index.js
```
