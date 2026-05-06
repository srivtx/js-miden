# S18 A/B Testing — v3 Add Validation

## The Bug: Validation Catches USER Bugs

Without validation, your API accepts anything:

```bash
curl http://localhost:3000/experiments/button-color?userId=alice
curl -X POST http://localhost:3000/experiments/button-color/conversion -d '{"userId":"alice","value":1}'
```

Your endpoints:
- Assign every user to a treatment → no control group
- Track conversions without checking assignment → attribution errors
- Calculate rates without total counts → meaningless percentages

## The Fix: Control Groups

```ts
// store.ts
interface Experiment {
  name: string;
  variants: string[];
  controlRatio: number; // e.g., 0.2 = 20% control
}

const experiments: Map<string, Experiment> = new Map();

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

  // Control group: first N% of hash space
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
```

**What this prevents:**
- All users getting treatments
- No baseline for comparison
- Unfair attribution

## The Pain That Remains

Variant A: 1000 users, 50 conversions (5%). Variant B: 1000 users, 60 conversions (6%). You declare B the winner. But the difference is not statistically significant (p=0.3). You ship B. In production, it performs at 4.8%. You made a Type I error.

## What v4 Fixes

Logging. Production without logs is flying blind.
