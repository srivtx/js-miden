# Old Ways vs New Ways (2015 vs 2025)

## Pattern: API Data Fetching

### The Old Way (2015)
```javascript
// REST: Multiple round-trips, over-fetching
fetch('/api/users/1').then(r => r.json()).then(user => {
  fetch('/api/users/1/posts').then(r => r.json()).then(posts => {
    // Fetched all post fields, only need title
  });
});
```
**Why we did it:** REST was the standard. HATEOAS was supposed to solve discovery.
**Why it's wrong now:** N+1 round-trips, over-fetching wastes bandwidth, no schema contract.

### The New Way (2025)
```graphql
query GetUserWithPosts($id: ID!) {
  user(id: $id) {
    name
    posts(limit: 5) { title }
  }
}
```
**Why it's better:** One request, exact field selection, typed schema, introspectable.

### Migration Path
1. Add a GraphQL gateway in front of REST services.
2. Use DataLoader to batch REST calls into single HTTP requests.
3. Deprecate REST endpoints as clients migrate.

---

## Pattern: Relational Data Resolution

### The Old Way
```javascript
// Raw SQL in resolver — N+1 guaranteed
const resolvers = {
  Post: {
    author: async (post) => {
      const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [post.authorId]);
      return rows[0];
    }
  }
};
```
**Why it's wrong:** Every post triggers a SQL query. 100 posts = 100 queries.

### The New Way
```typescript
// DataLoader batches per request
const loaders = createLoaders(); // Fresh per request
const resolvers = {
  Post: {
    author: (post, _args, context) => context.loaders.userLoader.load(post.authorId)
  }
};
```
**Why it's better:** 100 posts = 1 batched query. Automatic deduplication.

---

## Pattern: Real-Time Updates

### The Old Way
```javascript
// Long-polling every 5 seconds
setInterval(() => {
  fetch('/api/notifications').then(r => r.json()).then(console.log);
}, 5000);
```
**Why it's wrong:** Wastes bandwidth, stale data, battery drain on mobile.

### The New Way
```graphql
subscription OnCommentAdded($postId: ID!) {
  commentAdded(postId: $postId) { content author { name } }
}
```
**Why it's better:** Instant push, no polling, scoped to relevant data.

---

## Pattern: Query Security

### The Old Way
```javascript
// No validation. Client sends anything.
app.post('/graphql', (req, res) => {
  graphql(schema, req.body.query).then(result => res.json(result));
});
```
**Why it's wrong:** Recursive queries crash the server. No cost control.

### The New Way
```typescript
const server = new ApolloServer({
  schema,
  validationRules: [queryDepthLimiter],
  plugins: [queryComplexityPlugin, persistedQueriesPlugin],
});
```
**Why it's better:** Defense in depth — depth, complexity, and whitelist.

---

## Pattern: Schema Evolution

### The Old Way
```javascript
// Versioned REST: /api/v1/users, /api/v2/users
// Breaking changes force URL changes
```
**Why it's wrong:** Clients break, documentation drifts, multiple versions to maintain.

### The New Way
```graphql
# GraphQL: additive changes only
type User {
  id: ID!
  name: String!
  email: String! @deprecated(reason: "Use name + contact preference")
}
```
**Why it's better:** `@deprecated` marks fields without breaking clients. Schema registry tracks usage.
