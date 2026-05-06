# 03-randomization.md

## WHAT

Users must be randomly but deterministically assigned to variants.

## WHY

Randomization eliminates selection bias. Determinism ensures the same user always sees the same variant.

## HOW

```typescript
function assignVariant(experiment: string, userId: string): string {
  const hash = createHash('sha256')
    .update(`${experiment}:${userId}`)
    .digest('hex');
  const bucket = parseInt(hash.slice(0, 8), 16) % 100;
  
  if (bucket < 50) return 'control';
  if (bucket < 75) return 'variant-a';
  return 'variant-b';
}
```

This is consistent, uniformly distributed, and doesn't require storing assignments.
