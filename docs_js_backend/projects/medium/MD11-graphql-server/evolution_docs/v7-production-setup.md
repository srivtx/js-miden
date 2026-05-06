# MD11 GraphQL Server — v7 Production Setup

## Overview
The final evolution step turns the safe-but-simple GraphQL server into a production-grade gateway. We add schema stitching, depth limiting, query complexity analysis, persisted queries, and WebSocket subscriptions. Docker and health checks round out the deployment story.

## Changes
- **Schema Stitching**: Merge user and post subschemas with `@graphql-tools/stitch`.
- **Security Layer**:
  - `queryDepthLimiter` — rejects queries deeper than 10 levels.
  - `queryComplexityPlugin` — field-weighted cost scoring, rejects queries > 1000.
  - `persistedQueriesPlugin` — SHA-256 whitelist stored in Redis.
- **Subscriptions**: `graphql-ws` with `PubSub` (in-memory for demo, RedisPubSub recommended for prod).
- **Observability**: Pino logging + `/health` endpoint.
- **Deployment**: `Dockerfile`, `docker-compose.yml` with PostgreSQL and Redis.

## Code Snippet
```typescript
// src/server.ts (production-ready)
const server = new ApolloServer<Context>({
  schema: stitchedSchema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    queryComplexityPlugin,
    persistedQueriesPlugin,
  ],
  validationRules: [queryDepthLimiter],
  introspection: config.apolloIntrospection,
});

const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });
useServer({ schema: stitchedSchema, context: async () => ({ loaders: createLoaders(), pubsub }) }, wsServer);
```

## Rationale
- Depth + complexity + persisted queries provide **defense in depth** against DoS.
- Schema stitching lets teams own separate domains without a monolith.
- Subscriptions push real-time updates instead of polling.

## Trade-offs
- Stitching adds runtime delegation overhead; Apollo Federation with a router is the next scale step.
- Persisted queries require build-time registration, breaking ad-hoc playground usage in production.
- In-memory PubSub is a single-node bottleneck; replace with RedisPubSub for horizontal scaling.

## References
- `docs/02-DECISIONS.md` — why we chose stitching over Federation.
- `docs/06-BUGS.md` — depth limiter disabled (intentional bug for education).
- `docs/03-CONCEPTS.md` — DataLoader, complexity, persisted queries explained.
