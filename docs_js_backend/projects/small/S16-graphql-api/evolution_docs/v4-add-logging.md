# S16 GraphQL API — v4 Add Logging

## The Bug: Production Visibility Crisis

You deploy v3. Support ticket arrives: *"GraphQL is slow."*

You check the code. It looks correct. You have zero visibility into:

- What query did the client send?
- How deep was it?
- How many resolvers ran?
- How long did each take?

```ts
// Without logging — silent underperformance
app.all('/graphql', createHandler({ schema }));
```

## The Fix: Structured Logging

```ts
// index.ts
import { logger } from './logger.js';

app.use(depthLimit(5));

app.all('/graphql', (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  logger.debug({ requestId, query: req.body?.query }, 'GraphQL request');

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({ requestId, status: res.statusCode, durationMs: duration }, 'GraphQL response');
  });

  createHandler({ schema })(req, res, next);
});
```

```ts
// resolvers.ts
export function getAuthor(id: string): Author | undefined {
  logger.debug({ authorId: id }, 'Fetching author');
  return authors.find(a => a.id === id);
}
```

Now your logs tell the story:
```json
{"level":"debug","requestId":"abc","query":"{ posts { title author { name } } }","msg":"GraphQL request"}
{"level":"debug","authorId":"1","msg":"Fetching author"}
{"level":"debug","authorId":"1","msg":"Fetching author"}
{"level":"debug","authorId":"2","msg":"Fetching author"}
{"level":"info","requestId":"abc","status":200,"durationMs":150,"msg":"GraphQL response"}
```

Wait — `authorId: "1"` appears twice. Two posts by Alice = two `getAuthor` calls. The log reveals the N+1 problem.

## The Pain That Remains

You add DataLoader but forget to handle the case where the same author is requested across multiple queries in the same request. Your test with one query passes, but concurrent queries create race conditions. No test caught it.

## What v5 Fixes

Testing. Silent breakage when adding features is unacceptable.
