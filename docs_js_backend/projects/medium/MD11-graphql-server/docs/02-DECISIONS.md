# Architecture Decisions

## Decision: Schema Composition Strategy

### Option A: Schema Stitching (@graphql-tools/stitch)
**Pros:** Flexible type merging, works with existing schemas, no subgraph changes needed.
**Cons:** Runtime overhead, configuration complexity, error paths are harder to trace.

### Option B: Apollo Federation v2
**Pros:** Industry standard, router handles caching, declarative @key/@requires.
**Cons:** Requires subgraph compliance, heavier infrastructure, overkill for two schemas.

### Option C: Monolithic Schema
**Pros:** Simple, no delegation overhead, single source of truth.
**Cons:** Tight coupling, can't scale teams independently, can't merge external APIs.

### What We Chose: Schema Stitching
**Why:** We have a single codebase with user and post domains. Stitching lets us merge them without the operational burden of a federation router. We use type merging with `selectionSet` and `fieldName` delegation.

## Decision: N+1 Prevention Strategy

### Option A: DataLoader
**Pros:** Batching + caching per request, battle-tested, works with any ORM.
**Cons:** Cache invalidation is manual, can cache stale data if not reset per request.

### Option B: Prisma's Built-in Dataloader (Prisma Client N+1 Prevention)
**Pros:** Automatic, no extra code.
**Cons:** Only works for Prisma queries, not for custom data sources or REST microservices.

### Option C: JOIN Everything in Resolver
**Pros:** One query, no batching complexity.
**Cons:** Fragile, hard to maintain, doesn't scale to microservices.

### What We Chose: DataLoader
**Why:** Explicit control over batching, works across Prisma and future non-Prisma data sources. Fresh instances per request prevent cross-request caching bugs.

## Decision: Subscription Transport

### Option A: graphql-ws (WebSocket)
**Pros:** Modern protocol, subscribes over WebSocket, clean close handling.
**Cons:** Requires WebSocket support, harder to load-balance (sticky sessions).

### Option B: Server-Sent Events (SSE)
**Pros:** HTTP-based, easier to proxy, auto-reconnect.
**Cons:** Unidirectional (server→client), no subscription initialization from client.

### Option C: Apollo Subscriptions Transport (Deprecated)
**Pros:** Legacy compatibility.
**Cons:** Deprecated, security issues, no longer maintained.

### What We Chose: graphql-ws
**Why:** The modern standard. Works with Apollo Server 4. For load balancing, we'd add Redis PubSub in production.

## Decision: Query Security Layer

### Option A: Depth Limiting + Complexity Analysis + Persisted Queries
**Pros:** Defense in depth — depth blocks recursion, complexity blocks expensive queries, persisted queries block arbitrary execution.
**Cons:** Three layers to maintain, persisted queries require build-time registration.

### Option B: Allow-list Only (Persisted Queries)
**Pros:** Strongest security — only known queries execute.
**Cons:** Breaks ad-hoc tooling (GraphQL Playground, curl exploration).

### Option C: Timeouts Only
**Pros:** Simple.
**Cons:** Reactive, not preventive. Query can still exhaust DB before timeout fires.

### What We Chose: Depth + Complexity + Optional Persisted Queries
**Why:** Depth limiting stops recursion instantly. Complexity analysis catches wide queries (e.g., `users(limit: 10000)`). Persisted queries are optional for production hardening.
