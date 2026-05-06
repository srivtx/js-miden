# 08-conversion-tracking.md

## WHAT

Conversion events measure whether the variant achieved its goal.

## WHY

Assignment without conversion tracking tells us nothing about effectiveness.

## HOW

```typescript
function trackConversion(experiment: string, userId: string, value: number): void {
  conversions.push({
    userId,
    experiment,
    value,
    timestamp: new Date().toISOString(),
  });
}
```

Track:
- Primary metric (the goal)
- Guardrail metrics (things that shouldn't get worse)
- Segment breakdowns (mobile vs desktop)
