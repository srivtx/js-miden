# Testing Guide

## Test Structure

```
tests/
├── graphql.test.ts       # Main test suite
├── dataloader.test.ts    # DataLoader tests
├── complexity.test.ts    # Query complexity tests
├── persisted.test.ts     # Persisted queries tests
└── integration.test.ts   # End-to-end tests
```

## Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Run specific test
npx vitest run tests/graphql.test.ts
```

## Test Categories

### Unit Tests
Test individual functions in isolation:
- Depth calculation
- Complexity scoring
- DataLoader batching

### Integration Tests
Test component interactions:
- Schema stitching
- Database queries
- Redis caching

### Bug Demonstration Tests
Tests that prove known bugs exist:

#### Query Depth Bug
```typescript
it('should NOT block deeply nested recursive queries (BUG)', async () => {
  const deepQuery = /* 15-level nested query */;
  const response = await server.executeOperation({ query: deepQuery });
  // BUG: Should reject but doesn't
  expect(response.errors).toBeUndefined();
});
```

#### DataLoader N+1 Bug (if disabled)
```typescript
it('should batch user queries', async () => {
  // Mock DB and count calls
  // Without DataLoader: N+1 calls
  // With DataLoader: 2 calls (1 for posts, 1 batched for users)
});
```

## Writing Tests

### Test Utilities
```typescript
import { ApolloServer } from '@apollo/server';
import { makeExecutableSchema } from '@graphql-tools/schema';

export function createTestServer() {
  return new ApolloServer({
    schema: makeExecutableSchema({ typeDefs, resolvers }),
    plugins: [queryComplexityPlugin],
  });
}
```

### Mocking Prisma
```typescript
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    user: { findMany: vi.fn() },
    post: { findMany: vi.fn() },
  })),
}));
```

## Coverage

```bash
npx vitest run --coverage
```

Target coverage:
- Statements: 80%
- Branches: 75%
- Functions: 85%
- Lines: 80%

## Continuous Integration

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: graphql
          POSTGRES_PASSWORD: graphql_secret
          POSTGRES_DB: graphql_db
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run db:migrate
      - run: npm test
```

## References

- Vitest Documentation: https://vitest.dev/
- Apollo Server Testing: https://www.apollographql.com/docs/apollo-server/testing/testing/