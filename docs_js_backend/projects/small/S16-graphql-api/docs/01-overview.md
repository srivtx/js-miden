# 01-overview.md

## WHAT

A GraphQL server for a blog with posts, authors, queries, and mutations.

## WHY

GraphQL allows clients to request exactly the data they need, reducing over-fetching and under-fetching compared to REST. It provides a strongly-typed schema that serves as API documentation.

## HOW

- Define schema with types, queries, and mutations
- Implement resolvers that fetch data
- Use DataLoader to batch and cache database requests
- Add depth limiting to prevent recursive query DoS attacks
