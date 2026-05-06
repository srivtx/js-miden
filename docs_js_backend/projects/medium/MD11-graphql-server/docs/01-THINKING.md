# Thinking Process

## Mental Models

```
┌─────────────────┐
│   Client Apps   │
└────────┬────────┘
         │ GraphQL/WS
         ▼
┌─────────────────────────────┐
│    Apollo Server Express    │
│  ┌───────────────────────┐  │
│  │  Schema Stitching     │  │
│  │  (Federation Gateway) │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │  Validation Layer     │  │
│  │  - Depth Limiting     │  │
│  │  - Complexity Analysis│  │
│  │  - Persisted Queries  │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │  DataLoader Layer     │  │
│  │  (N+1 Prevention)     │  │
│  └───────────────────────┘  │
└────────┬────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐  ┌───────┐
│PostgreSQL│ │ Redis │
└─────────┘  └───────┘
```

## The Hot Path
The most frequent operation is a nested query like `posts { author { name } }`. Without DataLoader, resolving `author` for N posts generates N+1 database queries. The hot path must be O(1) batched lookups.

## The Danger Zone
1. **Recursive Query Attack**: A malicious client sends `user { posts { author { posts { author { ... } } } } }`. Without depth limiting, this exhausts the DB and crashes the Node.js process with stack overflow.
2. **N+1 in Production**: A query returning 100 posts with authors generates 101 SQL queries. At scale, this saturates the connection pool.
3. **Subscription Memory Leak**: In-memory PubSub keeps WebSocket references. If clients disconnect uncleanly, memory grows unbounded.

## Question Everything
- Do we need schema stitching? Yes, to merge user and post schemas without a monolith.
- Do we need Redis for PubSub? For a single instance, in-memory is fine. For production horizontal scaling, RedisPubSub is required.
- Do we need persisted queries? Yes — they prevent arbitrary query execution and reduce bandwidth.
- Do we allow introspection in production? No — it exposes the full schema to attackers.

## The "What If" Game
- What if a client sends a 10MB query string? Reject at body-parser limit.
- What if DataLoader caches across requests? Create fresh loaders per request context.
- What if a subscription topic has 10K listeners? Broadcast becomes O(n). Shard topics.
- What if the depth limiter is disabled? See Bug 1 in 06-BUGS.md.
