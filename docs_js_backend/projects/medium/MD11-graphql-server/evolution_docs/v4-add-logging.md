# MD11 GraphQL Server — v4 Add Logging

## Overview
Add structured request logging and introduce DataLoader to batch relational lookups. Logging lets us observe the N+1 fix in action (one batched query instead of N).

## Changes
- Add `pino` and `pino-http` for JSON logging.
- Create `src/dataloaders/index.ts` with per-request DataLoader instances.
- Update resolvers to use `context.loaders`.

## Code Snippet
```typescript
// src/dataloaders/index.ts
import DataLoader from 'dataloader';
import { prisma } from '../config/index.js';

async function batchUsers(ids: readonly string[]) {
  const users = await prisma.user.findMany({ where: { id: { in: [...ids] } } });
  const map = new Map(users.map(u => [u.id, u]));
  return ids.map(id => map.get(id) ?? null);
}

export function createLoaders() {
  return {
    userLoader: new DataLoader(batchUsers),
  };
}
```

```typescript
// server.ts context factory
context: async ({ req }) => {
  logger.info({ query: req.body.query }, 'incoming graphql request');
  return { loaders: createLoaders(), userId: req.headers['x-user-id'] as string };
}
```

## Rationale
- DataLoader batches 100 `author` resolutions into 1 SQL `WHERE id IN (...)`.
- Structured logs feed directly into Loki / CloudWatch for debugging.
- Each request gets a **fresh** DataLoader to avoid cross-request cache leaks.

## Trade-offs
- DataLoader adds a dependency and requires careful per-request instantiation.
- Logging every query can be noisy; we later sample in production.

## Next Step
Add automated tests (v5) to assert batching behavior and catch regressions.
