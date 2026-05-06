# 05-sample-size.md

## WHAT

Sample size calculation determines how many users are needed to detect an effect.

## WHY

Running an experiment with too few users risks false negatives. Too many wastes time.

## HOW

Use a power analysis formula or online calculator with:

- Baseline conversion rate
- Minimum detectable effect (MDE)
- Significance level (alpha, typically 0.05)
- Power (typically 0.8)

```typescript
function requiredSampleSize(baseline: number, mde: number): number {
  const p1 = baseline;
  const p2 = baseline + mde;
  const pooled = (p1 + p2) / 2;
  const zAlpha = 1.96;
  const zBeta = 0.84;
  
  return Math.ceil(
    (2 * pooled * (1 - pooled) * Math.pow(zAlpha + zBeta, 2)) / Math.pow(p2 - p1, 2)
  );
}
```
