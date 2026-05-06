# 00-PROBLEM.md

## WHAT Problem Does GraphQL Solve?

REST APIs force clients to accept fixed response shapes. A `/users` endpoint returns 20 fields even when the UI only needs `name` and `email`. A `/users/1/posts` endpoint returns posts but not authors, requiring N+1 follow-up requests. GraphQL was invented at Facebook in 2012 and open-sourced in 2015 to solve exactly this over-fetching and under-fetching problem.

**The Core Problem**: Client-server data mismatch

```
REST Mismatch:
┌──────────────┐      GET /users/1      ┌──────────────┐
│   Client     │  ─────────────────────>│   Server     │
│  Needs:      │                        │  Returns:    │
│  - name      │                        │  - id        │
│  - email     │      <─────────────────│  - name      │
│  - avatar    │   20 fields JSON       │  - email     │
└──────────────┘                        │  - phone     │
                                        │  - address   │
                                        │  - ... 14 more
                                        └──────────────┘
Result: 85% wasted bandwidth, slower mobile loads
```

## WHY This Matters

- **Mobile Performance**: Every wasted byte costs battery and load time on 3G networks
- **API Fragility**: Adding a field to REST breaks no one; removing one breaks everyone
- **Developer Velocity**: Frontend teams wait for backend teams to build bespoke endpoints
- **Cache Invalidation**: REST URLs cache well, but over-fetching poisons the cache with stale data

## HOW GraphQL Addresses It

GraphQL inverts the control: the client declares what it needs, and the server resolves only those fields.

```graphql
query {
  user(id: "1") {
    name
    email
    avatar
  }
}
```

The server returns exactly `{ name, email, avatar }` — no more, no less.

But GraphQL introduces NEW problems that this project explores:
1. **N+1 Query Problem**: Resolving nested fields naively triggers database queries exponentially
2. **Query Depth DoS**: Recursive schemas allow attackers to craft deeply nested queries that consume all server resources
3. **Type Safety Gap**: Without codegen, resolvers can return shapes that don't match the schema

## WRONG vs RIGHT

| Aspect | WRONG (REST-mimicking GraphQL) | RIGHT (Native GraphQL) |
|--------|-------------------------------|------------------------|
| Schema | Mirrors database tables 1:1 | Models domain concepts |
| Resolvers | One resolver per field, each hits DB | Batched via DataLoader |
| Queries | No validation, no limits | Depth limits, complexity analysis |
| Types | `any` everywhere | Codegen from schema |

## Real-World Impact

- **GitHub API v4 (GraphQL)**: Reduced average request count from 6 REST calls to 1 GraphQL query
- **Shopify**: 50% reduction in payload size after migrating to GraphQL
- **Twitter**: GraphQL improved time-to-interactive by 30% on mobile web
