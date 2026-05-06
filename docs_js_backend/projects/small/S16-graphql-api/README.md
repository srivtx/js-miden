# S16: GraphQL API

A GraphQL blog API built with Express 5, TypeScript, and ESM.

## Features

- Queries: `posts`, `post(id)`, `authors`
- Mutations: `createPost`, `updatePost`
- Real bugs: N+1 query problem, missing depth limit

## Bugs

1. **N+1 Query**: `getAuthor()` is called once per post instead of using DataLoader batching
2. **No Depth Limit**: Recursive queries like `posts { author { posts { author {...} } } }` are not blocked

## Quick Start

```bash
npm install
npm run dev
```

## Tests

```bash
npm test
```

Two tests will fail, demonstrating the bugs.
