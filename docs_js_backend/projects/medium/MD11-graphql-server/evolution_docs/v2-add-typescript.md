# MD11 GraphQL Server — v2 Add TypeScript

## Overview
Migrate the REST API to TypeScript. Define strict interfaces for `User`, `Post`, and `Comment`. This gives us a typed foundation that will evolve directly into GraphQL type definitions.

## Changes
- Rename `.js` → `.ts`
- Add `tsconfig.json` with `strict: true`
- Introduce `src/types.ts`

## Code Snippet
```typescript
// src/types.ts
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN' | 'MODERATOR';
  createdAt: Date;
  updatedAt: Date;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  published: boolean;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  content: string;
  postId: string;
  authorId: string;
  createdAt: Date;
}
```

## Rationale
- Type safety catches missing fields early.
- The interfaces above are a 1:1 preview of the GraphQL schema we will build in v3.
- Prisma's generated types align with these interfaces, reducing friction.

## Trade-offs
- Build step adds complexity.
- Need to install `@types/express` and configure `ts-node` or `tsx` for dev.

## Next Step
Introduce basic GraphQL and input validation (v3).
