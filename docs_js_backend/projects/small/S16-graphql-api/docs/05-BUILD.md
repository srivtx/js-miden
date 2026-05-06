# 05-BUILD.md

## Step-by-Step Build Instructions

### Prerequisites

- Node.js 20+
- npm 10+

### Step 1: Initialize Project

```bash
cd /Users/zen/Desktop/building-ai/docs_js_backend/projects/small/S16-graphql-api
npm install
```

Dependencies installed:
- `express` — HTTP server
- `graphql` — Core GraphQL library
- `graphql-http` — GraphQL over HTTP middleware
- `dataloader` — Batching and caching utility
- `typescript`, `tsx` — TypeScript compilation

### Step 2: Understand the File Structure

```
S16-graphql-api/
├── src/
│   ├── schema.ts      # GraphQL schema definition
│   ├── types.ts       # GraphQL object types (Post, Author)
│   ├── resolvers.ts   # Data fetching functions
│   ├── middleware.ts  # Depth limiting (BUGGY)
│   └── index.ts       # Express app setup
├── tests/
│   ├── resolvers.test.ts
│   └── middleware.test.ts
└── docs/
    └── ...
```

### Step 3: Review the Schema

```typescript
// src/schema.ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLList, GraphQLNonNull, GraphQLID } from 'graphql';

const queryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    posts: { type: new GraphQLList(postType), resolve: getPosts },
    post: { type: postType, args: { id: { type: new GraphQLNonNull(GraphQLID) } }, resolve: (_, args) => getPost(args.id) },
    authors: { type: new GraphQLList(authorType), resolve: getAuthors },
  },
});

const mutationType = new GraphQLObjectType({
  name: 'Mutation',
  fields: {
    createPost: { ... },
    updatePost: { ... },
  },
});

export const schema = new GraphQLSchema({ query: queryType, mutation: mutationType });
```

### Step 4: Run the Server

```bash
npm run dev
```

Server starts at `http://localhost:3000/graphql`

### Step 5: Test Queries in Browser/Playground

Open `http://localhost:3000/graphql` (if using Altair/GraphiQL) or use curl:

```bash
# Query all posts with authors
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ posts { id title author { name } } }"}'

# Create a post
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { createPost(title: \"New Post\", content: \"Content\", authorId: \"1\") { id title } }"}'
```

### Step 6: Run Tests (Two Should Fail)

```bash
npm test
```

Expected output:
```
✓ getPosts returns all posts
✓ getPost returns a post by id
✗ getAuthor is called once per post (N+1 bug)
✗ depthLimit blocks recursive queries (no-op middleware bug)
```

### Step 7: Fix Bug 1 — N+1 Query

**File**: `src/resolvers.ts`

**WRONG** (current):
```typescript
export function getAuthor(id: string): Author | undefined {
  console.log(`Fetching author ${id}`); // Called once per post!
  return authors.find(a => a.id === id);
}
```

**RIGHT** (fix):
```typescript
import DataLoader from 'dataloader';

const authorLoader = new DataLoader<string, Author | undefined>(async (ids) => {
  console.log(`Batch fetching authors: ${ids}`);
  return ids.map(id => authors.find(a => a.id === id));
});

export function getAuthor(id: string): Promise<Author | undefined> {
  return authorLoader.load(id);
}
```

Also update `src/types.ts` resolver since DataLoader returns a Promise:
```typescript
author: {
  type: authorType,
  resolve: async (post) => getAuthor(post.authorId),
}
```

### Step 8: Fix Bug 2 — Depth Limit

**File**: `src/middleware.ts`

**WRONG** (current):
```typescript
export function depthLimit(maxDepth: number) {
  return (req, res, next) => {
    next(); // Does nothing!
  };
}
```

**RIGHT** (fix):
```typescript
import { parse, DocumentNode } from 'graphql';

function calculateDepth(node: any, depth = 0): number {
  if (!node.selectionSet) return depth;
  let max = depth;
  for (const selection of node.selectionSet.selections) {
    max = Math.max(max, calculateDepth(selection, depth + 1));
  }
  return max;
}

export function depthLimit(maxDepth: number) {
  return (req, res, next) => {
    const query = req.body.query || '';
    try {
      const ast = parse(query);
      const depth = calculateDepth(ast.definitions[0]);
      if (depth > maxDepth) {
        return res.status(400).json({ error: `Query exceeds max depth of ${maxDepth}` });
      }
    } catch {
      // Invalid query, let GraphQL handle it
    }
    next();
  };
}
```

### Step 9: Verify Fixes

```bash
npm test
# All tests should pass now
```

### Step 10: Experiment

Try these queries to understand the system:

```graphql
# Basic query
query { posts { id title } }

# Nested query (triggers author resolver)
query { posts { id title author { name email } } }

# Deep query (should be blocked after fix)
query { posts { author { posts { author { posts { id } } } } } }

# Mutation
mutation { createPost(title: "Test", content: "Body", authorId: "1") { id author { name } } }
```
