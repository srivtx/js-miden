# Troubleshooting Guide

## Common Issues

### Query Depth Limit Not Working

**Symptom**: Server crashes on deeply nested recursive queries

**Root Cause**: The depth limiter validation rule is intentionally disabled
```typescript
// In src/utils/depth-limiter.ts
// BUG: Depth limit check disabled
// if (documentDepth > config.queryDepthLimit) {
//   context.reportError(...);
// }
```

**Fix**:
```typescript
if (documentDepth > config.queryDepthLimit) {
  context.reportError(
    new GraphQLError(
      `Query exceeds maximum depth of ${config.queryDepthLimit}`,
      { nodes: [node] }
    )
  );
}
```

### N+1 Query Problem

**Symptom**: Slow response times, database overload

**Root Cause**: Missing or misconfigured DataLoader

**Symptoms**:
- 100 posts generate 101 queries (1 for posts, 100 for authors)
- Response time increases linearly with result set size

**Fix**: Ensure DataLoader is properly configured:
```typescript
const loaders = createLoaders();
// Pass loaders in context
```

### Query Complexity Bypass

**Symptom**: Database crashes on complex queries

**Root Cause**: Complexity limit too high or not enforced

**Fix**: Lower complexity limit and add field-level weights:
```typescript
queryComplexityLimit: 500, // Reduce from 1000
```

### Subscription Not Working

**Symptom**: No real-time updates

**Checks**:
1. WebSocket connection established?
2. PubSub topic name matches?
3. Client subscribing to correct channel?

**Debug**:
```typescript
// Add logging to subscription resolver
subscribe: () => {
  console.log('New subscription');
  return pubsub.asyncIterator(['TOPIC']);
}
```

### Redis Connection Errors

**Symptom**: Persisted queries fail, subscriptions don't work

**Checks**:
```bash
redis-cli ping
# Should return PONG

redis-cli INFO server
# Check version >= 7
```

**Fix**:
```typescript
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});
```

### Database Connection Pool Exhaustion

**Symptom**: "Too many connections" errors

**Fix**: Use connection pooling:
```typescript
const prisma = new PrismaClient({
  connectionLimit: 20,
});
```

## Performance Issues

### Slow Query Response

**Diagnostic**:
1. Enable Prisma query logging
2. Check for N+1 patterns
3. Review query complexity scores
4. Check Redis cache hit rates

**Solutions**:
- Add database indexes
- Optimize DataLoader batch sizes
- Use Redis caching for hot data
- Add query result caching

### High Memory Usage

**Causes**:
- DataLoader cache not cleared
- Large query results
- Subscription memory leaks

**Fixes**:
```typescript
// Clear DataLoader cache per request
context.loaders.userLoader.clearAll();

// Limit result sizes
take: Math.min(limit, 100);

// Clean up subscriptions on disconnect
```

## Debugging Tools

### Apollo Studio
```bash
APOLLO_KEY=your-key npm start
```

### GraphQL Playground
```bash
# Enable in development
APOLLO_PLAYGROUND=true npm run dev
```

### Verbose Logging
```typescript
const server = new ApolloServer({
  plugins: [{
    async requestDidStart() {
      return {
        async didResolveOperation({ request }) {
          console.log('Query:', request.query);
        },
      };
    },
  }],
});
```

## Error Codes Reference

| Error | Cause | Solution |
|-------|-------|----------|
| GRAPHQL_PARSE_FAILED | Invalid syntax | Check query syntax |
| GRAPHQL_VALIDATION_FAILED | Schema mismatch | Verify field names |
| UNAUTHENTICATED | Missing auth token | Add x-user-id header |
| QUERY_TOO_COMPLEX | Exceeds limit | Simplify query |
| QUERY_TOO_LONG | Exceeds max length | Use persisted queries |
| INTERNAL_SERVER_ERROR | Unexpected error | Check server logs |

## Getting Help

- Apollo Discord: https://discord.gg/graphos
- GraphQL Community: https://graphql.org/community/
- Stack Overflow: [apollo-server] tag