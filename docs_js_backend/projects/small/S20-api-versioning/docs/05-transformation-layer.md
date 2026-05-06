# 05-transformation-layer.md

## WHAT

A transformation layer converts data between version formats.

## WHY

Instead of maintaining separate data stores, transform on the fly.

## HOW

```typescript
function transformV2toV1(user: UserV2): UserV1 {
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
  };
}

function transformV1toV2(user: UserV1): UserV2 {
  const parts = user.name.split(' ');
  return {
    id: user.id,
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}
```

v1 handlers read from the canonical v2 store and transform down.
