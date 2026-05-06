# Critic Review

## Technical Review
A senior engineer would say:
- "In-memory PubSub is a non-starter for production. One instance = subscriptions break on deploy. Use RedisPubSub or NATS."
- "Schema stitching with `selectionSet: '{ id }'` is fine for two types, but at scale, Apollo Federation with a router is the industry standard."
- "No rate limiting per API key. Complexity analysis stops expensive queries, but a client can still send 100 cheap queries/second."
- "Missing `@defer` and `@stream` directives. Large lists should be streamed, not buffered in memory."

## Security Review
- **Denial of Service**: The depth limiter is intentionally disabled (bug). A recursive query can crash the server.
- **Information Disclosure**: Introspection is enabled based on config. In production, introspection exposes the full schema to attackers.
- **No Auth in Subscriptions**: The WebSocket context only reads `x-user-id` header. No JWT validation, no session checking.
- **Persisted Query Whitelist**: The current implementation stores queries on first sight. A malicious client can register an expensive query, then execute it by hash.

## Educational Review
- **What's missing**: Federation router setup, `@key` directives, and subgraph compliance. This is stitching, not true federation.
- **What's confusing**: The difference between `user(id)` and `userById(id)` is unclear. `userById` exists only for stitching delegation.
- **Suggested addition**: A sequence diagram showing how DataLoader batches 100 `author` resolutions into 1 SQL query.

## Fixes Applied
- Added `queryDepthLimiter` validation rule. (Currently disabled for bug demonstration.)
- Added `queryComplexityPlugin` with field weights.
- Added `persistedQueriesPlugin` for query hashing.
- Added `graphql-ws` for modern subscription handling.
