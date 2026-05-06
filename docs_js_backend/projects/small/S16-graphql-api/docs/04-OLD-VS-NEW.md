# 04-OLD-VS-NEW.md

## 2015 Patterns vs 2025 Patterns

### Schema Definition

**2015: GraphQL-js (Code-First)**
```javascript
// Verbose, repetitive, easy to drift from reality
var PostType = new GraphQLObjectType({
  name: 'Post',
  fields: function() {
    return {
      id: { type: GraphQLID },
      title: { type: GraphQLString },
      author: { type: AuthorType }
    };
  }
});
```

**2025: Pothos / GraphQL Nexus**
```typescript
// Builder pattern, inferred types, less boilerplate
builder.objectType('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    author: t.field({ type: 'Author', resolve: (post) => ... }),
  }),
});
```

**2025: Schema-First with Codegen**
```graphql
# schema.graphql
type Post {
  id: ID!
  title: String!
  author: Author!
}
```
```typescript
// Auto-generated, never drifts
import { PostResolvers } from './generated/graphql';
export const Post: PostResolvers = { ... };
```

### Data Fetching

**2015: Raw Database Queries**
```javascript
// N+1 problem everywhere
resolve: (post) => {
  return db.query('SELECT * FROM authors WHERE id = ?', [post.authorId]);
}
```

**2025: DataLoader + DataloaderUtils**
```typescript
// Per-request loaders, automatic batching
const loaders = createLoaders();
resolve: (post, _args, { loaders }) => 
  loaders.author.byId.load(post.authorId);
```

**2025: Prisma / Drizzle with N+1 Prevention**
```typescript
// ORM automatically batches and deduplicates
prisma.post.findMany({ include: { author: true } });
// Generates optimal SQL with JOINs
```

### Security

**2015: Nothing**
```javascript
// Most GraphQL APIs had zero query protection
app.use('/graphql', graphqlHTTP({ schema }));
```

**2025: Defense in Depth**
```typescript
// Depth limit + complexity limit + persisted queries + timeout
const validationRules = [
  depthLimit(10),
  createComplexityLimitRule(1000),
  persistedQueryRule,
];
```

### Subscriptions

**2015: Apollo SubscriptionServer with Redis**
```javascript
// Complex, required separate server, pub/sub setup
const pubsub = new PubSub();
```

**2025: GraphQL over SSE / WebSockets**
```typescript
// Native SSE in graphql-yoga, simpler infrastructure
// Or GraphQL over WebSocket with graphql-ws library
```

### Error Handling

**2015: All errors leaked**
```json
{
  "errors": [{"message": "Cannot read property 'id' of undefined", "locations": [...]}]
}
```

**2025: Structured errors with extensions**
```json
{
  "errors": [{
    "message": "User not found",
    "extensions": {
      "code": "USER_NOT_FOUND",
      "statusCode": 404,
      "userId": "123"
    }
  }]
}
```

### Server Architecture

```
2015 Monolith:
┌─────────────────────────────────────┐
│  Express + GraphQL + DB in one app  │
└─────────────────────────────────────┘

2025 Federation / Microservices:
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Gateway    │────>│  Users API   │     │  Posts API   │
│  (Router)    │     │  (Subgraph)  │     │  (Subgraph)  │
└──────────────┘     └──────────────┘     └──────────────┘
```

**Key Lesson**: The fundamentals (schema, resolvers, N+1, depth limits) are identical. The tooling has matured to prevent footguns.
