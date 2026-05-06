# 08-CRITIQUE.md

## Critical Analysis

### What This Project Does Well

1. **Teaches Fundamentals**: Using raw `graphql-js` instead of Apollo Server exposes the AST, type system, and execution engine.
2. **Real Bugs**: The N+1 and depth limit bugs are genuinely common in production GraphQL APIs.
3. **Minimal Surface Area**: In-memory data store keeps the focus on GraphQL mechanics, not SQL.

### What This Project Lacks

1. **No Query Complexity Scoring**: Depth limiting alone is insufficient. A flat query like `{ post1 { ... } post2 { ... } ... post10000 { ... } }` has depth 2 but is still a DoS vector. Production APIs need both depth AND complexity limits.

2. **No Subscriptions**: Modern GraphQL APIs frequently use subscriptions for real-time updates. Adding a simple `postCreated` subscription would demonstrate the full GraphQL feature set.

3. **No Pagination**: Returning `[Post!]!` for `posts` is unrealistic. Production APIs use cursor-based pagination (Relay Connection spec) to prevent unbounded result sets.

4. **No Error Handling Strategy**: GraphQL's `errors` array leaks internal details by default. A production API should classify errors and return structured extensions.

5. **Introspection Always On**: In production, introspection should be disabled to reduce attack surface.

6. **No Persisted Queries**: Allowing arbitrary client queries is risky. Persisted queries (allow-listing) eliminate the entire class of malicious query attacks.

### Architecture Critique

```
Current (Monolithic):
┌──────────────┐
│   Express    │
│  + GraphQL   │
│  + Resolvers │
│  + DataStore │
└──────────────┘

Better (Layered):
┌──────────────┐
│   Express    │  HTTP / middleware / auth
├──────────────┤
│   GraphQL    │  Schema + validation
├──────────────┤
│  DataLoader  │  Batch + cache per request
├──────────────┤
│  Repository  │  Abstract data access
├──────────────┤
│   Database   │  PostgreSQL / MongoDB
└──────────────┘
```

### Testing Gaps

- No integration tests against the HTTP layer
- No benchmark tests proving DataLoader impact
- No property-based tests for query depth calculation

### Documentation Gaps

- No discussion of GraphQL fragments and their role in client-side caching
- No mention of `@defer` and `@stream` (modern GraphQL features for incremental delivery)
- No comparison with tRPC or gRPC for type-safe APIs

### The Meta-Critique

This codebase is designed for teaching, not production. That's valid, but students should explicitly be told:
- "You would use Apollo Server or Yoga in production"
- "You would add Prisma/Drizzle for database access"
- "You would deploy behind a CDN with persisted queries"

Without this context, students may cargo-cult the raw `graphql-js` approach into production codebases, creating unmaintainable monoliths.
