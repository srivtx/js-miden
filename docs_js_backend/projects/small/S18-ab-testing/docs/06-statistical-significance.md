# 06-statistical-significance.md

## WHAT

Statistical significance tells us if the observed difference is likely real or due to chance.

## WHY

Random variation means even identical experiences show different conversion rates. We need to quantify confidence.

## HOW

Use a two-proportion z-test:

```typescript
function zTest(control: VariantStats, treatment: VariantStats): number {
  const p1 = control.conversions / control.users;
  const p2 = treatment.conversions / treatment.users;
  const pooled = (control.conversions + treatment.conversions) / (control.users + treatment.users);
  
  const se = Math.sqrt(pooled * (1 - pooled) * (1/control.users + 1/treatment.users));
  return (p2 - p1) / se;
}

// p-value < 0.05 is typically considered significant
```
