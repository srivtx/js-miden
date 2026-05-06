# Testing Guide

## Test Structure

```
tests/
├── analytics.test.ts       # Main test suite
├── ingestion.test.ts       # Event ingestion tests
├── aggregation.test.ts     # Windowing tests
├── dashboard.test.ts       # Dashboard API tests
└── integration.test.ts     # End-to-end tests
```

## Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Run specific test
npx vitest run tests/analytics.test.ts
```

## Test Categories

### Unit Tests
- Window key generation
- Aggregation calculations
- Redis operations

### Integration Tests
- Event ingestion flow
- Dashboard queries
- Time-series retrieval

### Bug Demonstration Tests

#### Race Condition Bug
```typescript
it('should demonstrate race condition with concurrent updates', async () => {
  // Simulate 10 concurrent requests
  const promises = Array.from({ length: 10 }, () => 
    processEventWithRaceCondition(event)
  );
  
  await Promise.all(promises);
  
  const finalCount = await redis.get(`counter:${eventType}:${windowKey}`);
  
  // BUG: Count may be less than 10 due to race condition
  expect(parseInt(finalCount ?? '0', 10)).toBeLessThanOrEqual(10);
});
```

#### Atomic Operations Fix
```typescript
it('should handle concurrent updates atomically', async () => {
  const promises = Array.from({ length: 10 }, () => 
    processEventAtomically(event)
  );
  
  await Promise.all(promises);
  
  const finalCount = await redis.get(`counter:${eventType}:${windowKey}`);
  
  // With atomic operations, count is always 10
  expect(parseInt(finalCount ?? '0', 10)).toBe(10);
});
```

## Writing Tests

### Test Utilities
```typescript
export function createTestEvent(overrides = {}) {
  return {
    eventType: 'test',
    payload: { value: 1 },
    source: 'test',
    ...overrides,
  };
}
```

### Mocking Redis
```typescript
vi.mock('ioredis', () => ({
  default: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    incr: vi.fn(),
    del: vi.fn(),
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

## Load Testing

```bash
# Using artillery
artillery quick --count 1000 --num 50 http://localhost:3000/events
```

## Continuous Integration

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
```

## References

- Vitest Documentation: https://vitest.dev/
- Jest Testing Patterns: https://jestjs.io/docs/testing-async