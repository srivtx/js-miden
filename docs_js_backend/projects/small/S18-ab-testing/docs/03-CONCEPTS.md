# 03-CONCEPTS.md

## WHAT: A/B Testing Core Concepts

### Assignment

```typescript
// WHAT: Map users to experiment variants consistently
// WHY: Same user must always see same variant
// HOW: Deterministic hash of user ID + experiment name

import { createHash } from 'crypto';

function assignVariant(experiment: string, userId: string, variants: string[]): string {
  const hash = createHash('sha256')
    .update(`${experiment}:${userId}`)
    .digest('hex');
  const bucket = parseInt(hash.slice(0, 8), 16) % 100;
  
  // Distribute evenly across variants
  const variantIndex = Math.floor(bucket / (100 / variants.length));
  return variants[variantIndex];
}

// Example:
// bucket = 23 -> variantIndex = 0 -> "control"
// bucket = 67 -> variantIndex = 1 -> "treatment"
```

### Conversion Tracking

```typescript
// WHAT: Record when a user in an experiment achieves the goal
// WHY: Without conversions, assignment is meaningless
// HOW: Log conversion with user ID, experiment, variant, and timestamp

interface Conversion {
  userId: string;
  experiment: string;
  variant: string;
  value: number;  // Revenue, signups, etc.
  timestamp: string;
}
```

### Statistical Significance (Two-Proportion Z-Test)

```typescript
// WHAT: Calculate if observed difference is likely real
// WHY: Random variation produces different rates even with identical experiences
// HOW: z = (p2 - p1) / SE, compare to critical value

function zTest(control: Stats, treatment: Stats): number {
  const p1 = control.conversions / control.users;  // Control rate
  const p2 = treatment.conversions / treatment.users;  // Treatment rate
  
  const pooled = (control.conversions + treatment.conversions) / 
                 (control.users + treatment.users);
  
  const se = Math.sqrt(
    pooled * (1 - pooled) * (1/control.users + 1/treatment.users)
  );
  
  return (p2 - p1) / se;
}

// z > 1.96 => p < 0.05 (significant at 95% confidence)
// z > 2.58 => p < 0.01 (significant at 99% confidence)
```

### Sample Size Calculation

```typescript
// WHAT: Determine how many users needed to detect an effect
// WHY: Too few = false negative. Too many = wasted time.
// HOW: Power analysis formula

function requiredSampleSize(baselineRate: number, mde: number): number {
  const p1 = baselineRate;
  const p2 = baselineRate + mde;
  const pooled = (p1 + p2) / 2;
  
  const zAlpha = 1.96;  // 95% confidence
  const zBeta = 0.84;   // 80% power
  
  return Math.ceil(
    (2 * pooled * (1 - pooled) * Math.pow(zAlpha + zBeta, 2)) / 
    Math.pow(p2 - p1, 2)
  );
}

// Example: baseline = 0.05 (5%), mde = 0.01 (1% absolute)
// Required: ~12,000 per variant
```

## WHY: Deterministic Assignment Matters

```
WRONG: Math.random() per request

Request 1 (09:00): User-123 -> "red" button
Request 2 (09:05): User-123 -> "blue" button (refreshed page!)
Request 3 (09:10): User-123 -> "red" button (clicked back!)

Result:
  - User is confused by changing UI
  - Conversion tracking attributes to wrong variant
  - Experiment data is garbage
```

```
RIGHT: Hash-based assignment

Request 1 (09:00): User-123 -> hash("button-color:User-123") % 100 = 42 -> "red"
Request 2 (09:05): User-123 -> hash("button-color:User-123") % 100 = 42 -> "red"
Request 3 (09:10): User-123 -> hash("button-color:User-123") % 100 = 42 -> "red"

Result:
  - Consistent experience
  - Clean attribution
  - Valid experiment
```

## HOW: Control Group Enables Causal Inference

```
Without Control:

Treatment conversion rate: 6%
  -> Is this good? We don't know.
  -> Maybe baseline was 8% and we made things WORSE.

With Control:

Control conversion rate: 5%
Treatment conversion rate: 6%
Lift: (6% - 5%) / 5% = 20% relative improvement
z-test: z = 2.1, p = 0.036

Result: Statistically significant 20% lift.
Action: Roll out treatment.
```

## WRONG vs RIGHT: Experiment Design

```typescript
// WRONG: No control group
const experiment = {
  name: 'button-color',
  variants: ['red', 'blue'],  // Both are treatments!
};

// RIGHT: Control + treatment
const experiment = {
  name: 'button-color',
  variants: ['control', 'red', 'blue'],  // Control is baseline
};
```

```typescript
// WRONG: Non-deterministic assignment
function assignVariant(experiment, userId) {
  return experiment.variants[Math.floor(Math.random() * experiment.variants.length)];
}

// RIGHT: Deterministic hash
function assignVariant(experiment, userId) {
  const hash = sha256(`${experiment.name}:${userId}`);
  const bucket = parseInt(hash.slice(0, 8), 16) % 100;
  return experiment.variants[Math.floor(bucket / (100 / experiment.variants.length))];
}
```
