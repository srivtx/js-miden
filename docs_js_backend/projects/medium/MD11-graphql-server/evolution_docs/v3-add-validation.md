# MD11 GraphQL Server — v3 Add Validation

## Overview
Replace the REST router with a basic GraphQL endpoint using `graphql-http`. We introduce the schema, resolvers, and Zod validation for mutations. At this stage we intentionally do **not** use DataLoader, so the N+1 problem is visible.

## Changes
- Add `graphql` and `graphql-http` packages.
- Create `src/schema/typeDefs.ts` and `src/resolvers/index.ts`.
- Add Zod schemas for mutation inputs.

## Code Snippet
```typescript
// src/schema/typeDefs.ts
export const typeDefs = `#graphql
  type Query {
    users(limit: Int = 20): [User!]!
    user(id: ID!): User
    posts(limit: Int = 20): [Post!]!
  }
  type Mutation {
    createPost(input: CreatePostInput!): Post!
  }
  type User { id: ID! email: String! name: String! posts: [Post!]! }
  type Post { id: ID! title: String! content: String! author: User! }
  input CreatePostInput { title: String! content: String! }
`;
```

```typescript
// src/resolvers/index.ts (naive — N+1 exposed)
export const resolvers = {
  Post: {
    author: async (post) => {
      // N+1: one query per post
      return prisma.user.findUnique({ where: { id: post.authorId } });
    },
  },
};
```

## Rationale
- GraphQL eliminates over-fetching: clients request exactly `title` and `author.name`.
- Validation at the API boundary (Zod) prevents bad data before it hits Prisma.
- **Intentionally leaving N+1 unpatched** so we can measure the impact and fix it in v4.

## Trade-offs
- `graphql-http` is minimal; no built-in playground or subscriptions yet.
- No security rules: clients can send arbitrarily deep queries.

## Next Step
Add structured logging (v4) and DataLoader to solve N+1.
