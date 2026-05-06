# S16 GraphQL API — v7 Production Setup

## The Journey

We started with REST over-fetching, layered in GraphQL, TypeScript, depth limiting, logging, tests, and ESM. Now we have a GraphQL API that respects performance and security.

## What v7 Adds

- **DataLoader**: Batches N+1 queries into a single lookup
- **Per-request context**: Isolates DataLoader caches per user
- **Depth limiting**: Prevents infinite recursion and stack overflow
- **Type safety**: TypeScript enforces resolver signatures
- **Schema definition**: Explicit types prevent runtime surprises

## The Final Code

```ts
// src/types.ts
import { GraphQLObjectType, GraphQLString, GraphQLID } from 'graphql';

export const authorType = new GraphQLObjectType({
  name: 'Author',
  fields: () => ({
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    email: { type: GraphQLString },
  }),
});

export const postType = new GraphQLObjectType({
  name: 'Post',
  fields: () => ({
    id: { type: GraphQLID },
    title: { type: GraphQLString },
    content: { type: GraphQLString },
    author: {
      type: authorType,
      resolve: (post, _args, context) => context.authorLoader.load(post.authorId),
    },
    authorId: { type: GraphQLID },
  }),
});
```

```ts
// src/resolvers.ts
import DataLoader from 'dataloader';

interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
}

interface Author {
  id: string;
  name: string;
  email: string;
}

const authors: Author[] = [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
  { id: '2', name: 'Bob', email: 'bob@example.com' },
];

const posts: Post[] = [
  { id: '1', title: 'Hello World', content: 'First post', authorId: '1' },
  { id: '2', title: 'GraphQL 101', content: 'Intro to GraphQL', authorId: '1' },
  { id: '3', title: 'Event Sourcing', content: 'Events everywhere', authorId: '2' },
];

export function createAuthorLoader() {
  return new DataLoader<string, Author | undefined>(async (ids) => {
    console.log(`Batch fetching authors: ${ids}`);
    return ids.map(id => authors.find(a => a.id === id));
  });
}

export function getPosts(): Post[] {
  return posts;
}

export function getPost(id: string): Post | undefined {
  return posts.find(p => p.id === id);
}

export function getAuthors(): Author[] {
  return authors;
}

export function createPost(args: { title: string; content: string; authorId: string }): Post {
  const post: Post = {
    id: String(posts.length + 1),
    title: args.title,
    content: args.content,
    authorId: args.authorId,
  };
  posts.push(post);
  return post;
}

export function updatePost(args: { id: string; title?: string; content?: string }): Post | undefined {
  const post = posts.find(p => p.id === args.id);
  if (!post) return undefined;
  if (args.title) post.title = args.title;
  if (args.content) post.content = args.content;
  return post;
}
```

```ts
// src/schema.ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLList, GraphQLNonNull, GraphQLID } from 'graphql';
import { postType, authorType } from './types.js';
import { getPosts, getPost, getAuthors, createPost, updatePost } from './resolvers.js';

const queryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    posts: {
      type: new GraphQLList(postType),
      resolve: getPosts,
    },
    post: {
      type: postType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
      },
      resolve: (_, args) => getPost(args.id),
    },
    authors: {
      type: new GraphQLList(authorType),
      resolve: getAuthors,
    },
  },
});

const mutationType = new GraphQLObjectType({
  name: 'Mutation',
  fields: {
    createPost: {
      type: postType,
      args: {
        title: { type: new GraphQLNonNull(GraphQLString) },
        content: { type: new GraphQLNonNull(GraphQLString) },
        authorId: { type: new GraphQLNonNull(GraphQLID) },
      },
      resolve: (_, args) => createPost(args),
    },
    updatePost: {
      type: postType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        title: { type: GraphQLString },
        content: { type: GraphQLString },
      },
      resolve: (_, args) => updatePost(args),
    },
  },
});

export const schema = new GraphQLSchema({
  query: queryType,
  mutation: mutationType,
});
```

```ts
// src/middleware.ts
import { Request, Response, NextFunction } from 'express';

export function depthLimit(maxDepth: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body && req.body.query) {
      const depth = calculateDepth(req.body.query);
      if (depth > maxDepth) {
        res.status(400).json({ error: `Query exceeds max depth of ${maxDepth}` });
        return;
      }
    }
    next();
  };
}

function calculateDepth(query: string): number {
  let maxDepth = 0;
  let currentDepth = 0;
  for (const char of query) {
    if (char === '{') {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (char === '}') {
      currentDepth--;
    }
  }
  return maxDepth;
}
```

```ts
// src/index.ts
import express from 'express';
import { createHandler } from 'graphql-http/lib/use/express';
import { schema } from './schema.js';
import { depthLimit } from './middleware.js';
import { createAuthorLoader } from './resolvers.js';

const app = express();
const PORT = 3000;

app.use(depthLimit(5));

app.all('/graphql', createHandler({
  schema,
  context: () => ({
    authorLoader: createAuthorLoader(),
  }),
}));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/graphql`);
});

export { app };
```

## Why This Matters in Production

Without DataLoader, fetching 100 posts with their authors triggers 101 database queries. Without depth limiting, a malicious client can crash your server with recursive queries. Without per-request context, data leaks between users. Without TypeScript, schema changes break resolvers silently.

## Pain → Solution Summary

| Version | Pain | Solution |
|---------|------|----------|
| v1 | REST over-fetching and under-fetching | Basic GraphQL concept |
| v2 | Typos in resolver signatures | TypeScript interfaces |
| v3 | Infinite recursion | Depth limiting middleware |
| v4 | No visibility into query performance | Structured logging |
| v5 | Global DataLoader leaks data | Vitest tests per-request isolation |
| v6 | CJS module resolution issues | ESM with NodeNext |
| v7 | N+1 queries | DataLoader batching + per-request context |

## Run It

```bash
PORT=3000 NODE_ENV=production node dist/index.js
```
