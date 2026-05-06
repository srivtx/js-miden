# 09-bugs.md

## WHAT

Two intentional bugs demonstrate common A/B testing mistakes.

## WHY

Non-deterministic assignment and missing control groups make experiments meaningless.

## HOW

### Bug 1: Non-deterministic Assignment

**Symptom**: `Math.random()` assigns different variants on each request.

**Impact**: User sees A then B, invalidating the experiment.

**Fix**: Use hash-based assignment:

```typescript
const hash = createHash('sha256').update(`${experiment}:${userId}`).digest('hex');
const bucket = parseInt(hash.slice(0, 8), 16) % 100;
return bucket < 50 ? 'control' : 'treatment';
```

### Bug 2: No Control Group

**Symptom**: All users get a treatment variant.

**Impact**: Cannot measure whether the change actually helped.

**Fix**: Always include a control variant in the experiment definition.

```typescript
const variants = ['control', 'treatment'];
```
