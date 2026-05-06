# S18 A/B Testing — v4 Add Logging

## The Bug: Production Visibility Crisis

You deploy v3. Support ticket arrives: *"The experiment says B won but revenue dropped."*

You check the code. It looks correct. You have zero visibility into:

- How many users were in each variant?
- What was the conversion rate?
- Was the difference significant?
- Were there any biases?

```ts
// Without logging — silent bad decisions
export function getStats(experimentName: string) {
  const experiment = experiments.get(experimentName);
  const stats = {
    variants: experiment.variants.map(v => ({
      name: v,
      conversionRate: variantConversions / variantUsers,
    })),
  };
  return stats;
}
```

## The Fix: Structured Logging

```ts
// store.ts
import { logger } from './logger.js';

export function assignVariant(experimentName: string, userId: string): string {
  const experiment = experiments.get(experimentName);
  if (!experiment) {
    logger.warn({ experimentName, userId }, 'Experiment not found');
    return 'control';
  }

  const hash = createHash('md5').update(userId + experimentName).digest('hex');
  const hashInt = parseInt(hash, 16);

  if (hashInt % 100 < experiment.controlRatio * 100) {
    logger.info({ experimentName, userId, variant: 'control' }, 'Assigned to control');
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

  logger.info({ experimentName, userId, variant }, 'Assigned to variant');
  return variant;
}

export function trackConversion(experimentName: string, userId: string, value: number): void {
  conversions.push({
    userId,
    experiment: experimentName,
    value,
    timestamp: new Date().toISOString(),
  });
  logger.info({ experimentName, userId, value }, 'Conversion tracked');
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

  logger.info({ experimentName, stats }, 'Stats calculated');
  return stats;
}
```

Now your logs tell the story:
```json
{"level":"info","experimentName":"button-color","userId":"alice","variant":"red","msg":"Assigned to variant"}
{"level":"info","experimentName":"button-color","userId":"alice","value":1,"msg":"Conversion tracked"}
{"level":"info","experimentName":"button-color","stats":{"totalUsers":2000},"msg":"Stats calculated"}
```

Wait — the stats don't include a p-value or confidence interval. The log reveals the missing statistical significance bug.

## The Pain That Remains

You add a t-test but forget to handle the case where one variant has zero users (division by zero). Your test with balanced traffic passes, but the edge case crashes. No test caught it.

## What v5 Fixes

Testing. Silent breakage when adding features is unacceptable.
