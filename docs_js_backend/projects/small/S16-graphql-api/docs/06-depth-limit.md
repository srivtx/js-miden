# 06-depth-limit.md

## WHAT

Depth limiting prevents recursive queries that could cause DoS attacks.

## WHY

A query like `{ posts { author { posts { author { posts { ... } } } } } }` can recurse infinitely, consuming server resources.

## HOW

Parse the query AST and calculate the maximum nesting depth. Reject queries exceeding the limit.

```typescript
function getDepth(ast: DocumentNode): number {
  // Recursively calculate selection set depth
}

if (getDepth(query) > maxDepth) {
  throw new Error('Query exceeds maximum depth');
}
```

Current implementation is a no-op middleware that doesn't enforce any limit.
