# Step-by-Step Build Guide

## Step 1: Define the Schema

Create type definitions that model the domain.

```typescript
export const typeDefs = `#graphql
  type Query {
    users(limit: Int = 20, offset: Int = 0): [User!]!
    user(id: ID!): User
    posts(limit: Int = 20, offset: Int = 0): [Post!]!
    post(id: ID!): Post
    comments(postId: ID!): [Comment!]!
  }

  type Mutation {
    createPost(input: CreatePostInput!): Post!
    createComment(input: CreateCommentInput!): Comment!
  }

  type Subscription {
    postCreated: Post!
    commentAdded(postId: ID!): Comment!
  }

  type User { id: ID! email: String! name: String! posts(limit: Int = 20, offset: Int = 0): [Post!]! }
  type Post { id: ID! title: String! content: String! author: User! comments(limit: Int = 20, offset: Int = 0): [Comment!]! }
  type Comment { id: ID! content: String! post: Post! author: User! }

  input CreatePostInput { title: String! content: String! published: Boolean = false }
  input CreateCommentInput { postId: ID! content: String! }
`;
```

### Common Mistakes
- **Mistake**: Using `[User]` instead of `[User!]!`.
- **Why it breaks**: Nullable lists allow `null` elements and `null` lists, complicating client code.
- **How to avoid**: Use non-null everywhere unless nullability is semantically meaningful.

## Step 2: Implement DataLoader Batch Functions

```typescript
import DataLoader from 'dataloader';

async function batchUsers(ids: readonly string[]) {
  const users = await prisma.user.findMany({ where: { id: { in: [...ids] } } });
  const userMap = new Map(users.map(u => [u.id, u]));
  return ids.map(id => userMap.get(id) ?? null);
}

export function createLoaders() {
  return {
    userLoader: new DataLoader(batchUsers),
    postLoader: new DataLoader(batchPosts),
  };
}
```

### Common Mistakes
- **Mistake**: Sharing one DataLoader across all requests.
- **Why it breaks**: Cross-request caching leaks data between users.
- **How to avoid**: Create new loaders in the `context` factory for every request.

## Step 3: Add Depth Limiting

```typescript
export function queryDepthLimiter(context: ValidationContext) {
  return {
    Document(node) {
      const depth = calculateDepth(node, 0);
      if (depth > config.queryDepthLimit) {
        context.reportError(
          new GraphQLError(`Query exceeds maximum depth of ${config.queryDepthLimit}`)
        );
      }
    },
  };
}
```

### Common Mistakes
- **Mistake**: Commenting out the limit check "for debugging".
- **Why it breaks**: Recursive queries crash production.
- **How to avoid**: Depth limiting must be non-optional in all environments.

## Step 4: Add Query Complexity Analysis

```typescript
export const queryComplexityPlugin = {
  async requestDidStart() {
    return {
      async didResolveOperation({ request, document }) {
        let totalComplexity = 0;
        for (const def of document.definitions) {
          if (def.kind === 'OperationDefinition') {
            for (const sel of def.selectionSet.selections) {
              if (sel.kind === 'Field') totalComplexity += calculateComplexity(sel, 0);
            }
          }
        }
        if (totalComplexity > config.queryComplexityLimit) {
          throw new GraphQLError('Query too complex', { extensions: { code: 'QUERY_TOO_COMPLEX' } });
        }
      },
    };
  },
};
```

### Common Mistakes
- **Mistake**: Giving all fields a weight of 1.
- **Why it breaks**: A flat query with 10K fields passes, but is still expensive.
- **How to avoid**: Weight fields by their data volume. Multiply by pagination args.

## Step 5: Implement Persisted Queries

```typescript
export const persistedQueriesPlugin = {
  async requestDidStart() {
    return {
      async didResolveOperation({ request, document }) {
        if (!document || !request.query) return;
        const hash = crypto.createHash('sha256').update(request.query).digest('hex');
        await redis.setex(`pq:${hash}`, 86400, request.query);
      },
    };
  },
};
```

### Common Mistakes
- **Mistake**: Allowing arbitrary queries in production.
- **Why it breaks**: Attackers can craft expensive queries even with depth/complexity limits.
- **How to avoid**: Require persisted query hashes for production traffic.

## Step 6: Wire Up Subscriptions

```typescript
const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });
const serverCleanup = useServer({ schema: stitchedSchema, context: async () => ({ loaders: createLoaders(), pubsub }) }, wsServer);
```

### Common Mistakes
- **Mistake**: Not disposing the WebSocket server on shutdown.
- **Why it breaks**: Hanging connections prevent graceful shutdown.
- **How to avoid**: Use `ApolloServerPluginDrainHttpServer` and `serverCleanup.dispose()`.
