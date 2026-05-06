# Concepts Explained

## Concept: DataLoader

### WHAT Is It?
A utility for batching and caching data fetches. Coalesces multiple individual loads into a single batched function call.

### WHY Do We Use It?
GraphQL resolvers are tree-traversal functions. Resolving `posts { author { name } }` calls the `author` resolver once per post. Without batching, that's N queries. DataLoader batches them into 1 query.

### HOW Does It Work?
```typescript
// WRONG: N+1 queries — one per post
const posts = await prisma.post.findMany();
for (const post of posts) {
  const author = await prisma.user.findUnique({ where: { id: post.authorId } }); // N queries
}

// RIGHT: DataLoader batches into 1 query
const authorLoader = new DataLoader(async (authorIds) => {
  const authors = await prisma.user.findMany({ where: { id: { in: authorIds } } });
  return authorIds.map(id => authors.find(a => a.id === id));
});

// In resolver:
author: (post) => authorLoader.load(post.authorId) // 1 batched query
```

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| Reusing DataLoader across requests | Fresh DataLoader per request context |
| Loading inside a loop without batching | Using `load()` and letting DataLoader batch |
| Caching forever (stale data) | Cache only for the request lifetime |

---

## Concept: Query Depth Limiting

### WHAT Is It?
A validation rule that rejects GraphQL queries whose abstract syntax tree (AST) exceeds a maximum nesting depth.

### WHY Do We Use It?
Recursive schemas (User → Posts → Author → Posts → ...) allow infinite nesting. A 15-level deep query can crash the server or exhaust the database.

### HOW Does It Work?
```typescript
// Traverses the AST recursively
function calculateDepth(node, depth = 0) {
  if (node.kind === 'Field' && node.selectionSet) {
    return Math.max(...node.selectionSet.selections.map(s => calculateDepth(s, depth + 1)));
  }
  return depth;
}

if (documentDepth > MAX_DEPTH) {
  throw new GraphQLError('Query too deep');
}
```

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| Disabling depth limiter "for testing" | Enforcing depth limit in all environments |
| Limiting only by string length | Limiting by AST depth (string length is bypassable) |
| Depth limit of 100 | Depth limit of 5-10 for most schemas |

---

## Concept: Query Complexity Analysis

### WHAT Is It?
Assigning a cost score to each field and rejecting queries whose total score exceeds a threshold.

### WHY Do We Use It?
Depth limiting alone doesn't catch wide queries: `users(limit: 10000) { posts(limit: 100) { comments } }` is only 3 levels deep but returns millions of rows.

### HOW Does It Work?
```typescript
const COMPLEXITY_WEIGHTS = {
  users: 10,      // Returns many entities
  posts: 10,
  comments: 5,
  user: 3,        // Single entity
  author: 5,      // Cross-entity join
};

function calculateComplexity(node, depth = 0) {
  const weight = COMPLEXITY_WEIGHTS[node.name.value] ?? 1;
  const depthMultiplier = Math.pow(1.5, depth);
  let total = weight * depthMultiplier;
  // ... recurse into children
  return total;
}
```

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| Uniform weight for all fields | Weight proportional to data volume |
| Ignoring pagination arguments | Multiplying cost by `limit` arguments |
| Static threshold for all users | Per-user or per-API-key thresholds |

---

## Concept: Persisted Queries

### WHAT Is It?
Clients send a SHA-256 hash of a pre-registered query instead of the full query string.

### WHY Do We Use It?
1. **Bandwidth**: Hash is 64 bytes vs. multi-KB query strings.
2. **Security**: Server only executes whitelisted queries. Arbitrary query attacks are impossible.

### HOW Does It Work?
```bash
# Register (one-time)
curl -X POST /graphql -d '{ "query": "query GetUsers { users { id name } }" }'
# Server stores: pq:<sha256_hash> -> query string

# Execute (every time)
curl -X POST /graphql -d '{
  "extensions": { "persistedQuery": { "version": 1, "sha256Hash": "abc123..." } }
}'
```

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| Allowing arbitrary queries in production | Requiring persisted queries for production clients |
| Storing queries in memory only | Persisting to Redis with TTL |
| Hashing with MD5 | Hashing with SHA-256 |

---

## Concept: Schema Stitching

### WHAT Is It?
Combining multiple GraphQL schemas into a single gateway schema with cross-schema type merging.

### WHY Do We Use It?
Teams can own separate schemas (User service, Post service) while clients see one unified graph.

### HOW Does It Work?
```typescript
const stitchedSchema = stitchSchemas({
  subschemas: [{
    schema: executableSchema,
    merge: {
      User: {
        selectionSet: '{ id }',
        fieldName: 'userById',
        args: (originalObject) => ({ id: originalObject.id }),
      },
    },
  }],
});
```

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| Merging schemas with naming collisions | Using type merging with explicit selection sets |
| Delegating every field individually | Delegating only at entity boundaries |
| No gateway error handling | Catching and enriching subschema errors |

---

## Concept: GraphQL Subscriptions

### WHAT Is It?
Real-time event streaming from server to client over a persistent connection (WebSocket).

### WHY Do We Use It?
Clients need live updates (new post created, comment added) without polling.

### HOW Does It Work?
```typescript
// Server publishes
createPost(input) {
  const post = await prisma.post.create({ ... });
  await pubsub.publish('POST_CREATED', { postCreated: post });
  return post;
}

// Client subscribes
subscription OnPostCreated {
  postCreated { id title author { name } }
}
```

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|------- |
| Using in-memory PubSub in a multi-instance deployment | Using Redis PubSub for cross-instance broadcasting |
| Broadcasting to all clients unconditionally | Filtering subscriptions by topic arguments (e.g., `commentAdded(postId: "123")`) |
| Not cleaning up on disconnect | Using `useServer` cleanup and drain handlers |
