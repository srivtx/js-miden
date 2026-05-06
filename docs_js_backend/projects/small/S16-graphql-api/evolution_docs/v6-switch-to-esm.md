# S16 GraphQL API — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your project uses `require()` and `module.exports`:

```js
// CommonJS — works, but dated
const express = require('express');
const { GraphQLSchema, GraphQLObjectType } = require('graphql');

module.exports = { schema };
```

**Problems:**
1. No top-level await
2. `require()` loads synchronously and caches aggressively
3. Named exports are fragile
4. Modern packages ship ESM-only
5. `__dirname` and `__filename` are CJS-only

## The Fix: ESM

```json
// package.json
{
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

```ts
// src/index.ts
import express from 'express';
import { createHandler } from 'graphql-http/lib/use/express';
import { schema } from './schema.js';
import { depthLimit } from './middleware.js';

const app = express();
const PORT = 3000;

app.use(depthLimit(5));
app.all('/graphql', createHandler({ schema }));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/graphql`);
});

export { app };
```

```ts
// src/schema.ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLInt, GraphQLList, GraphQLNonNull, GraphQLID } from 'graphql';
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

**What ESM gives you:**
- Static analysis
- Explicit file extensions
- Modern Node.js alignment

## The Pain That Remains

You have TypeScript, depth limiting, logging, tests, and ESM. But `getAuthor` is still called for every post. DataLoader is imported but not used. The N+1 problem remains. You need per-request DataLoader instances.

## What v7 Fixes

Final production setup. DataLoader batching, per-request context, and proper depth limiting.
