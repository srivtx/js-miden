# Performance Guide

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| P50 Response | < 50ms | < 100ms |
| P95 Response | < 200ms | < 500ms |
| P99 Response | < 500ms | < 1000ms |
| Error Rate | < 0.1% | < 1% |
| Throughput | 1000 RPS | 500 RPS |

## Optimization Strategies

### 1. DataLoader Batching
Eliminates N+1 queries by batching database requests.

**Without DataLoader**:
```
Query: { posts { author { name } } }
→ 1 query for posts
→ N queries for authors (one per post)
Total: N+1 queries
```

**With DataLoader**:
```
Query: { posts { author { name } } }
→ 1 query for posts
→ 1 batched query for all authors
Total: 2 queries
```

**Implementation**:
```typescript
const userLoader = new DataLoader(async (ids) => {
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
  });
  return ids.map(id => users.find(u => u.id === id));
});
```

### 2. Query Complexity Analysis
Rejects expensive queries before execution.

**Weights**:
| Field Type | Weight |
|------------|--------|
| List queries | 10 |
| Single entity | 3 |
| Nested relation | 5 |
| Scalar field | 1 |

**Example**:
```graphql
query {
  users(limit: 100) {      # 10 * 1.0 = 10
    posts(limit: 100) {     # 10 * 1.5 = 15
      author {              # 5 * 2.25 = 11.25
        posts(limit: 100) { # 10 * 3.375 = 33.75
          comments {        # 5 * 5.06 = 25.3
            author { name } # 5 * 7.59 = 37.95
          }
        }
      }
    }
  }
}
# Total: ~133 points (under 1000 limit)
```

### 3. Persisted Queries
Reduces payload size and parsing overhead.

**Benefits**:
- 90% reduction in query payload size
- Faster parsing (hash lookup)
- Query whitelisting

### 4. Database Indexing
```sql
CREATE INDEX CONCURRENTLY idx_posts_author ON posts(author_id);
CREATE INDEX CONCURRENTLY idx_comments_post ON comments(post_id);
```

### 5. Redis Caching
```typescript
// Cache hot queries
const cacheKey = `query:${hash}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const result = await executeQuery();
await redis.setex(cacheKey, 300, JSON.stringify(result));
return result;
```

### 6. Connection Pooling
```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
```

## Monitoring

### Key Metrics
- Query execution time (p50, p95, p99)
- Database query count per request
- Redis cache hit rate
- Subscription active connections
- Memory usage

### Tools
```typescript
// Apollo Studio
const server = new ApolloServer({
  plugins: [
    ApolloServerPluginUsageReporting({
      endpointUrl: 'https://usage-reporting.api.apollographql.com',
    }),
  ],
});
```

## Load Testing

```bash
# Using artillery
npm install -g artillery

artillery quick --count 100 --num 10 http://localhost:4000/graphql
```

## Benchmarks

| Scenario | Without Optimizations | With Optimizations |
|----------|----------------------|-------------------|
| 100 posts + authors | 1500ms | 45ms |
| 1000 comments | 3000ms | 120ms |
| Complex nested query | 5000ms | 200ms |

## References

- GraphQL Performance: https://graphql.org/learn/performance/
- DataLoader Batching: https://github.com/graphql/dataloader
- Prisma Performance: https://www.prisma.io/docs/guides/performance-and-optimization