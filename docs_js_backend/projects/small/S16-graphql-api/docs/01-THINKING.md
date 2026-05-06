# 01-THINKING.md

## Design Thinking: From REST to GraphQL

When we designed this blog API, we started with the user journey, not the database schema.

### User Journeys

1. **Homepage**: List all posts with author names
2. **Post Detail**: Show post content, author info, and related posts
3. **Admin Panel**: Create and edit posts

### REST Thinking (Old Way)

```
GET /posts              -> [{ id, title, authorId }]
GET /authors/:id        -> { id, name, email }
GET /posts/:id          -> { id, title, content, authorId }
PUT /posts/:id          -> { id, title, content }

Homepage requires: 1 + N requests (1 for posts, N for authors)
```

### GraphQL Thinking (New Way)

```graphql
query Homepage {
  posts {
    id
    title
    author { name }
  }
}

# Single request. Client gets exactly what it needs.
```

### Mental Model Shift

| REST Mindset | GraphQL Mindset |
|-------------|-----------------|
| "What endpoints do I need?" | "What types exist in my domain?" |
| "One endpoint per resource" | "One endpoint, many queries" |
| "Server decides response shape" | "Client declares response shape" |
| "Caching by URL" | "Caching by query + entity keys" |

### The Schema-First Approach

We design the schema BEFORE writing any resolver code. This is the contract between frontend and backend teams.

```
Design Order:
1. Types (Post, Author)
2. Relationships (Post.author -> Author)
3. Root fields (Query.posts, Query.post, Mutation.createPost)
4. Resolver implementation
5. Performance optimization (DataLoader)
```

### Thinking About Performance

The naive GraphQL implementation is SLOWER than REST because:
- REST can JOIN tables server-side
- GraphQL resolvers run independently and may each query the DB

**Solution**: Think about data fetching patterns at schema design time.

```
Posts { author }  <- If 100 posts, this fires 100 getAuthor() calls
                   <- WRONG: N+1 problem
                   
Posts { author }  <- DataLoader batches into 1 getAuthors([id1, id2, ...])
                   <- RIGHT: Constant time
```

### Thinking About Security

GraphQL is more exposed than REST:
- REST hides fields behind endpoint definitions
- GraphQL exposes the entire schema via introspection
- Clients can craft arbitrarily complex queries

**Solution**: Depth limits, complexity scoring, and persisted queries.
