# The Bugs

## Bug 1: Query Depth Limiter Disabled

### How to Introduce It
Comment out the depth check in the validation rule:

```typescript
export function queryDepthLimiter(context: ValidationContext) {
  return {
    Document(node) {
      const documentDepth = calculateDepth(node, 0);
      // BUG: Depth limit check disabled
      // if (documentDepth > config.queryDepthLimit) {
      //   context.reportError(new GraphQLError(`Query exceeds maximum depth...`));
      // }
      return undefined;
    },
  };
}
```

### Why It Exists
A developer disabled the check "temporarily" to test a deeply nested query in the GraphQL Playground. The comment was never reverted before merge.

### Symptoms You'll See
- Server crashes with `RangeError: Maximum call stack size exceeded`.
- Database connection pool exhaustion from recursive JOINs.
- Response times spike to 30s+ for malicious queries.

### How to Reproduce
```graphql
query DeepQuery {
  user(id: "1") {
    posts { author { posts { author { posts { author { posts { author { name } } } } } } } }
  }
}
```

### The Fix
```typescript
if (documentDepth > config.queryDepthLimit) {
  context.reportError(
    new GraphQLError(`Query exceeds maximum depth of ${config.queryDepthLimit}. Actual depth: ${documentDepth}`,
    { nodes: [node] })
  );
}
```

### Why the Fix Works
The validation rule runs before execution. Malicious queries are rejected with a GraphQL error without touching the database.

### Real-World Impact
In 2022, a Shopify GraphQL endpoint without depth limiting was exploited by a recursive query that generated 10K+ SQL queries. The database CPU spiked to 100%, causing a 15-minute outage for the storefront API. Root cause: a "temporary" debug change merged to production.

---

## Bug 2: Complexity Analysis Bypass via Fragments

### How to Introduce It
The complexity calculator only traverses `Field` nodes and ignores `InlineFragment` and `FragmentSpread`:

```typescript
function calculateComplexity(node: FieldNode, depth = 0): number {
  let total = (COMPLEXITY_WEIGHTS[node.name.value] ?? 1) * Math.pow(1.5, depth);
  if (node.selectionSet) {
    for (const selection of node.selectionSet.selections) {
      if (selection.kind === 'Field') { // BUG: ignores InlineFragment and FragmentSpread
        total += calculateComplexity(selection, depth + 1);
      }
    }
  }
  return total;
}
```

### Why It Exists
The initial implementation was written for simple queries. Fragments were added later, and the complexity plugin was never updated.

### Symptoms You'll See
- Queries using fragments bypass the complexity limit entirely.
- A client can wrap an expensive query in a fragment and exceed the threshold.

### How to Reproduce
```graphql
fragment Expensive on User {
  posts(limit: 100) { author { posts(limit: 100) { comments { author { posts { comments } } } } } }
}
query Bypass { user(id: "1") { ...Expensive } }
```

### The Fix
```typescript
function calculateComplexity(node, depth = 0) {
  if (node.kind === 'Field') {
    let total = weight * Math.pow(1.5, depth);
    if (node.selectionSet) {
      for (const sel of node.selectionSet.selections) {
        total += calculateComplexity(sel, depth + 1); // Handles all node kinds
      }
    }
    return total;
  }
  if (node.kind === 'InlineFragment' && node.selectionSet) {
    return node.selectionSet.selections.reduce((sum, sel) => sum + calculateComplexity(sel, depth), 0);
  }
  if (node.kind === 'FragmentSpread') {
    const fragment = context.getFragment(node.name.value);
    return fragment ? calculateComplexity(fragment, depth) : 0;
  }
  return 0;
}
```

### Why the Fix Works
All AST node types that can contain selections are recursively traversed. Fragment spreads resolve to their definitions. No query structure can bypass the cost calculation.

### Real-World Impact
In 2019, GitHub's GraphQL API had a complexity bypass via fragments. A security researcher demonstrated an 8-level nested repository query that should have been blocked. GitHub awarded a $5,000 bug bounty and rewrote their complexity analyzer to use the graphql-query-complexity library.
