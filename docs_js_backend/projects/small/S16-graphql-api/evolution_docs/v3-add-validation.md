# S16 GraphQL API — v3 Add Validation

## The Bug: Validation Catches USER Bugs

Without validation, your API accepts anything:

```graphql
query {
  posts {
    title
    author {
      name
      posts {
        title
        author {
          name
          posts {
            title
            # ... infinite recursion
          }
        }
      }
    }
  }
}
```

Your endpoint:
- Executes the query without depth limits → stack overflow or infinite loop
- Calls `getAuthor` for every post → N+1 queries
- Returns everything the client asks for → no field-level authorization

## The Fix: Depth Limiting

```ts
// middleware.ts
import { Request, Response, NextFunction } from 'express';

export function depthLimit(maxDepth: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body && req.body.query) {
      const depth = calculateDepth(req.body.query);
      if (depth > maxDepth) {
        res.status(400).json({ error: `Query exceeds max depth of ${maxDepth}` });
        return;
      }
    }
    next();
  };
}

function calculateDepth(query: string): number {
  let maxDepth = 0;
  let currentDepth = 0;
  for (const char of query) {
    if (char === '{') {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (char === '}') {
      currentDepth--;
    }
  }
  return maxDepth;
}
```

```ts
// index.ts
import express from 'express';
import { createHandler } from 'graphql-http/lib/use/express';
import { schema } from './schema.js';
import { depthLimit } from './middleware.js';

const app = express();
const PORT = 3000;

app.use(depthLimit(5));
app.all('/graphql', createHandler({ schema }));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/graphql`);
});
```

**What this prevents:**
- Infinite recursion via depth limits
- Stack overflow from deeply nested queries
- Unbounded computation

## The Pain That Remains

A query for 100 posts still calls `getAuthor` 100 times. The depth is within limits, but the database is hammered. You need batching.

## What v4 Fixes

Logging. Production without logs is flying blind.
