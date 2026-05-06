# The Problem

## What Are We Building?
A production-grade GraphQL server with schema stitching, DataLoader batching, query complexity analysis, persisted queries, and real-time subscriptions. This is the API gateway layer for a content platform (users, posts, comments).

## Why Does This Problem Exist?
REST APIs force clients to make multiple round-trips, over-fetch fields they don't need, and under-fetch related data. GraphQL promises a single endpoint with precise data selection. But naive GraphQL implementations suffer from N+1 queries, denial-of-service via recursive queries, and unbounded execution costs. Building a *safe* GraphQL server is an order of magnitude harder than building a functional one.

## Who Will Use It?
- **Frontend Developers**: Query exactly the fields they need in one request.
- **Mobile Clients**: Reduce payload size with precise selection.
- **External Partners**: Consume a unified schema stitched from multiple sub-services.

## Constraints
- **Latency**: P95 < 100ms for simple queries, < 500ms for deeply nested.
- **Security**: Must reject queries exceeding depth 10 or complexity score 1000.
- **Scale**: Handle 1000+ concurrent subscriptions via WebSocket.
- **Correctness**: DataLoader must batch all per-request relational lookups.

## What We're NOT Building
- We are NOT building a full GraphQL federation gateway (no router, no subgraph introspection).
- We are NOT building a generic BaaS (no file uploads, no custom directives).
- We are NOT building a persisted-query whitelist with build-time validation.
