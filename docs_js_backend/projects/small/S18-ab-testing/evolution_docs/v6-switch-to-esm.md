# S18 A/B Testing — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your project uses `require()` and `module.exports`:

```js
// CommonJS — works, but dated
const express = require('express');
const { createHash } = require('crypto');

module.exports = { assignVariant, trackConversion };
```

**Problems:**
1. No top-level await
2. `require()` loads synchronously and caches aggressively
3. Named exports are fragile
4. Modern packages ship ESM-only
5. `__dirname` and `__filename` are CJS-only

## The Fix: ESM

```json
// package.json
{
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

```ts
// src/index.ts
import express from 'express';
import { experimentRouter } from './routes.js';

const app = express();
app.use(express.json());
app.use('/experiments', experimentRouter);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

export { app };
```

```ts
// src/store.ts
import { createHash } from 'crypto';

interface Experiment {
  name: string;
  variants: string[];
  controlRatio: number;
}

interface Assignment {
  userId: string;
  experiment: string;
  variant: string;
  timestamp: string;
}

interface Conversion {
  userId: string;
  experiment: string;
  value: number;
  timestamp: string;
}

const experiments: Map<string, Experiment> = new Map();
const assignments: Assignment[] = [];
const conversions: Conversion[] = [];

experiments.set('button-color', {
  name: 'button-color',
  variants: ['red', 'blue'],
  controlRatio: 0.2,
});

export function assignVariant(experimentName: string, userId: string): string {
  const experiment = experiments.get(experimentName);
  if (!experiment) return 'control';

  const hash = createHash('md5').update(userId + experimentName).digest('hex');
  const hashInt = parseInt(hash, 16);

  if (hashInt % 100 < experiment.controlRatio * 100) {
    return 'control';
  }

  const index = Math.floor((hashInt / 100) % experiment.variants.length);
  const variant = experiment.variants[index];

  assignments.push({
    userId,
    experiment: experimentName,
    variant,
    timestamp: new Date().toISOString(),
  });

  return variant;
}

export function trackConversion(experimentName: string, userId: string, value: number): void {
  conversions.push({
    userId,
    experiment: experimentName,
    value,
    timestamp: new Date().toISOString(),
  });
}

export function getStats(experimentName: string): Record<string, unknown> | null {
  const experiment = experiments.get(experimentName);
  if (!experiment) return null;

  const expAssignments = assignments.filter(a => a.experiment === experimentName);
  const expConversions = conversions.filter(c => c.experiment === experimentName);

  const stats = {
    experiment: experimentName,
    totalUsers: expAssignments.length,
    variants: experiment.variants.map(v => {
      const variantUsers = expAssignments.filter(a => a.variant === v).length;
      const variantConversions = expConversions.filter(c => {
        const assignment = expAssignments.find(a => a.userId === c.userId && a.variant === v);
        return assignment !== undefined;
      });
      const totalValue = variantConversions.reduce((sum, c) => sum + c.value, 0);
      return {
        name: v,
        users: variantUsers,
        conversions: variantConversions.length,
        conversionRate: variantUsers > 0 ? variantConversions.length / variantUsers : 0,
        totalValue,
      };
    }),
  };

  return stats;
}
```

**What ESM gives you:**
- Static analysis
- Explicit file extensions
- Modern Node.js alignment

## The Pain That Remains

You have TypeScript, consistent assignment, control groups, logging, tests, and ESM. But you don't check for statistical significance. You might ship a variant that's actually worse. You also don't prevent bias — new users might be unevenly distributed.

## What v7 Fixes

Final production setup. Statistical significance testing and bias prevention.
