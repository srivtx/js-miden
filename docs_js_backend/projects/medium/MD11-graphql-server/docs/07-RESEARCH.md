# Research Notes

## Sources
- **GraphQL Specification (2021 Edition)**: https://spec.graphql.org/October2021/
  - Defines query validation rules, introspection, and execution semantics. Our depth limiter and complexity analysis are custom validation rules extending the spec's `ValidationContext`.
- **Byron, L. & Nadel, D. (2015-2021). "GraphQL: A Query Language for APIs"**. Facebook Engineering / GraphQL Foundation.
  - Original rationale for GraphQL: precise data fetching, strong typing, and introspection.
- **Hart, B. (2020). "Production Ready GraphQL"**. Manning Publications.
  - Chapter 6 covers query security: depth limiting, complexity analysis, and persisted queries. Recommends defense-in-depth (multiple layers).
- **DataLoader**: https://github.com/graphql/dataloader
  - Lee Byron's reference implementation. Key insight: "batching and caching should be per-request, not global."
- **Apollo Server Security**: https://www.apollographql.com/docs/apollo-server/security/
  - Official recommendations for preventing DoS: depth limiting, complexity analysis, and persisted queries.
- **Sadowski, C. et al. (2018). "Lessons from Building Static Analysis Tools at Google"**. ACM Queue.
  - While focused on static analysis, the paper's cost-model approach inspired our field-weighted complexity scoring.
- **Fielding, R. (2000). "Architectural Styles and the Design of Network-based Software Architectures"**. PhD Thesis, UC Irvine.
  - REST constraints (statelessness, cacheability) are contrasted with GraphQL's client-driven queries.

## Latest Trends (2025)
- **GraphQL over HTTP (Spec)**: Standardized `POST` and `GET` methods for GraphQL. Persisted queries are now first-class.
- **GraphQL JIT**: Compiling resolvers to machine code for 10x throughput improvement.
- **Apollo Federation v2.7**: `@composeDirective` and entity interfaces. Subgraph schemas are becoming more expressive.
- **GraphQL Armor**: Open-source middleware suite (depth limiting, cost analysis, block field suggestions) that plugs into any server.

## Benchmarks
- DataLoader batching: 100 individual loads → 1 query (99% reduction in DB round-trips).
- Depth limiting overhead: ~0.1ms per query (AST traversal is cheap).
- Complexity analysis overhead: ~0.2ms per query for queries under 50 fields.
- graphql-ws vs legacy subscriptions-transport-ws: 40% lower memory footprint, cleaner close handling.

## Industry Adoption
- **Shopify**: Uses persisted queries for all Storefront API traffic. No arbitrary query execution in production.
- **GitHub**: Custom complexity scoring with per-node multipliers. Public API has a max node limit of 500,000.
- **Meta**: Internal GraphQL gateways use depth limiting + field cost + timeout triple defense.
- **Netflix**: Federated GraphQL with DataLoader across microservices. Schema stitching at the edge, federation internally.
