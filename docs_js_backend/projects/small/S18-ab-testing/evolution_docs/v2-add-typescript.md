# S18 A/B Testing — v2 Add TypeScript

## The Bug: Types Catch YOUR Bugs

You add consistent assignment:

```js
function assignVariant(experimentName, userId) {
  const hash = require('crypto').createHash('md5').update(userId + experimentName).digest('hex');
  const index = parseInt(hash, 16) % 2;
  return ['A', 'B'][index];
}
```

**The bug:** `userId` might be `undefined`. `undefined + experimentName` = `"undefinedbutton-color"`. The hash is deterministic but for the wrong user. TypeScript would flag `userId` as `string | undefined`.

Another bug: you treat `variantConversions` as a number but it's an array:

```js
const conversionRate = variantConversions / variantUsers; // [object Object] / 50 = NaN
```

TypeScript would flag the type mismatch.

## The Fix: Add TypeScript

```ts
// store.ts
import { createHash } from 'crypto';

interface Experiment {
  name: string;
  variants: string[];
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
});

export function assignVariant(experimentName: string, userId: string): string {
  const experiment = experiments.get(experimentName);
  if (!experiment) return 'control';

  const hash = createHash('md5').update(userId + experimentName).digest('hex');
  const index = parseInt(hash, 16) % experiment.variants.length;
  const variant = experiment.variants[index];

  assignments.push({
    userId,
    experiment: experimentName,
    variant,
    timestamp: new Date().toISOString(),
  });

  return variant;
}
```

Now `tsc` errors on:
```
store.ts:34:28 - error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
```

## But TypeScript Doesn't Catch Everything

TypeScript validates **compile-time** shapes, not **runtime** fairness. A client can still:
- Assign 90% to variant A and 10% to variant B
- Skip control groups
- Ignore statistical significance
- Introduce selection bias

We need control groups and statistical tests.

> **Lesson:** TypeScript eliminates typos and wrong shapes. But experiment validity requires control groups and statistics.

## What v3 Fixes

Control groups. Reserve a portion of users as a baseline.
