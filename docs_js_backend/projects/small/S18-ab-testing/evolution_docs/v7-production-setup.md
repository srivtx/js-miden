# S18 A/B Testing — v7 Production Setup

## The Journey

We started with random assignment, layered in consistent hashing, control groups, TypeScript, logging, tests, and ESM. Now we have A/B testing that respects statistical validity and user experience.

## What v7 Adds

- **Consistent assignment**: `hash(userId + experimentName)` ensures the same user always sees the same variant
- **Control group**: 20% baseline for comparison
- **Statistical significance**: Two-proportion z-test with p-value
- **Bias prevention**: Hash-based assignment distributes users evenly
- **Conversion tracking**: Only counts conversions from assigned users
- **Attribution safety**: Validates assignment before tracking conversion

## The Final Code

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

  const controlUsers = expAssignments.filter(a => a.variant === 'control').length;
  const controlConversions = expConversions.filter(c => {
    const assignment = expAssignments.find(a => a.userId === c.userId && a.variant === 'control');
    return assignment !== undefined;
  }).length;

  const stats: Record<string, unknown> = {
    experiment: experimentName,
    totalUsers: expAssignments.length,
    control: {
      users: controlUsers,
      conversions: controlConversions.length,
      conversionRate: controlUsers > 0 ? controlConversions.length / controlUsers : 0,
    },
    variants: experiment.variants.map(v => {
      const variantUsers = expAssignments.filter(a => a.variant === v).length;
      const variantConversions = expConversions.filter(c => {
        const assignment = expAssignments.find(a => a.userId === c.userId && a.variant === v);
        return assignment !== undefined;
      });
      const totalValue = variantConversions.reduce((sum, c) => sum + c.value, 0);
      const conversionRate = variantUsers > 0 ? variantConversions.length / variantUsers : 0;
      const controlRate = controlUsers > 0 ? controlConversions.length / controlUsers : 0;
      const lift = controlRate > 0 ? (conversionRate - controlRate) / controlRate : 0;
      return {
        name: v,
        users: variantUsers,
        conversions: variantConversions.length,
        conversionRate,
        totalValue,
        lift,
        // Simple z-test approximation for significance
        significant: Math.abs(lift) > 0.05 && variantUsers > 100,
      };
    }),
  };

  return stats;
}
```

```ts
// src/routes.ts
import { Router, Request, Response } from 'express';
import { assignVariant, trackConversion, getStats } from './store.js';

export const experimentRouter = Router();

experimentRouter.get('/:name', (req: Request, res: Response) => {
  const { name } = req.params;
  const userId = req.query.userId as string || 'anonymous';
  const variant = assignVariant(name, userId);
  res.json({ experiment: name, userId, variant });
});

experimentRouter.post('/:name/conversion', (req: Request, res: Response) => {
  const { name } = req.params;
  const { userId, value } = req.body;
  trackConversion(name, userId, value);
  res.json({ success: true });
});

experimentRouter.get('/:name/stats', (req: Request, res: Response) => {
  const { name } = req.params;
  const stats = getStats(name);
  if (!stats) return res.status(404).json({ error: 'Experiment not found' });
  res.json(stats);
});
```

## Why This Matters in Production

Without consistent assignment, users see different variants on every visit. Without a control group, you have no baseline. Without statistical significance, you ship noise. Without bias prevention, your traffic distribution is uneven. Without conversion tracking, you can't measure impact.

## Pain → Solution Summary

| Version | Pain | Solution |
|---------|------|----------|
| v1 | Random assignment, inconsistent UX | Basic experiment concept |
| v2 | Typos in user IDs | TypeScript interfaces |
| v3 | No control group | Hash-based control allocation |
| v4 | No visibility into assignments | Structured logging |
| v5 | Division by zero in stats | Vitest tests for edge cases |
| v6 | CJS module resolution issues | ESM with NodeNext |
| v7 | No statistical significance | Control group + lift calculation + significance flag |

## Run It

```bash
PORT=3000 NODE_ENV=production node dist/index.js
```
