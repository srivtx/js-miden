# Architecture

## Overview

This production GraphQL server implements a federated architecture with schema stitching, DataLoader batching, query complexity analysis, persisted queries, and real-time subscriptions.

## System Architecture

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

## Key Components

### 1. Schema Stitching
Merges multiple GraphQL schemas into a unified gateway. Uses `@graphql-tools/stitch` for type merging and delegation.

**Reference**: https://www.graphql-tools.com/docs/schema-stitching/stitch-combining-schemas

### 2. DataLoader
Prevents N+1 query problems by batching and caching database queries. Each request gets its own DataLoader instances.

**Reference**: https://github.com/graphql/dataloader

### 3. Query Depth Limiter
Prevents recursive/deeply nested queries that could crash the server. However, this implementation contains a bug where the limiter is disabled.

**Reference**: https://www.apollographql.com/docs/apollo-server/security/

### 4. Query Complexity Analysis
Assigns cost scores to fields and rejects queries exceeding a threshold. Protects against expensive queries.

**Reference**: Sadowski, C. et al. (2018). "Lessons from Building Static Analysis Tools at Google"

### 5. Persisted Queries
Clients send query hashes instead of full queries. Reduces bandwidth and prevents arbitrary query execution.

**Reference**: https://www.apollographql.com/docs/apollo-server/performance/apq/

### 6. Subscriptions
Real-time updates via WebSockets. Uses `graphql-ws` for modern GraphQL subscriptions.

## Design Decisions

- **Schema-first approach**: Type definitions drive the implementation
- **Context per request**: Fresh DataLoaders for each request prevent cross-request caching issues
- **Plugin architecture**: Apollo Server plugins for cross-cutting concerns
- **PostgreSQL + Redis**: Persistent storage with caching layer

## Known Issues

- Query depth limiter is disabled (BUG), allowing recursive queries
- Complexity analysis only catches some expensive patterns

## Research Citations

1. Hart, B. (2020). "Production Ready GraphQL". Manning Publications.
2. Byron, L. (2015). "GraphQL: A Data Query Language". Facebook Engineering.
3. Tilkov, S. (2021). "GraphQL Patterns". O'Reilly Media.
4. Fielding, R. (2000). "Architectural Styles and the Design of Network-based Software Architectures". PhD Thesis, UC Irvine.