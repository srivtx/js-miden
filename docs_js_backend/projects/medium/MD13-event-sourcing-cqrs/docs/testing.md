# Testing Guide

## Test Structure

```
tests/
├── cqrs.test.ts          # Main test suite
├── commands.test.ts      # Command handler tests
├── event-store.test.ts   # Event store tests
├── projection.test.ts    # Projection tests
└── integration.test.ts   # End-to-end tests
```

## Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Run specific test
npx vitest run tests/cqrs.test.ts
```

## Test Categories

### Unit Tests
- Event creation
- Command validation
- State replay

### Integration Tests
- Command → Event Store → Projection flow
- Eventual consistency handling
- Snapshot operations

### Bug Demonstration Tests

#### Direct Read from Write Model (BUG)
```typescript
it('should allow reading directly from event store (defeats CQRS)', async () => {
  const command = new PlaceOrderCommand();
  const result = await command.execute({...});

  // BUG: Reading directly from event store
  const order = await readModel.getByIdFromEventStore(result.aggregateId);
  
  expect(order).toBeDefined();
  // This proves the bug - write model should not be queried
});
```

#### Eventual Consistency Gap (BUG)
```typescript
it('should fail to find order immediately after creation', async () => {
  const command = new PlaceOrderCommand();
  const result = await command.execute({...});

  // Query read model immediately
  const order = await readModel.getById(result.aggregateId);
  
  // BUG: Returns null because projection hasn't run yet
  expect(order).toBeNull();
});
```

## Writing Tests

### Test Utilities
```typescript
export function createTestOrder(overrides = {}) {
  return {
    customerId: '550e8400-e29b-41d4-a716-446655440000',
    items: [
      {
        productId: '550e8400-e29b-41d4-a716-446655440001',
        quantity: 2,
        unitPrice: 29.99,
      },
    ],
    totalAmount: 59.98,
    shippingAddress: {
      street: '123 Main St',
      city: 'Springfield',
      country: 'USA',
      zipCode: '12345',
    },
    ...overrides,
  };
}
```

### Mocking Prisma
```typescript
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    eventStore: { create: vi.fn(), findMany: vi.fn() },
    orderReadModel: { findUnique: vi.fn(), upsert: vi.fn() },
  })),
}));
```

## Coverage

```bash
npx vitest run --coverage
```

Target coverage:
- Statements: 85%
- Branches: 80%
- Functions: 90%
- Lines: 85%

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
        env:
          POSTGRES_USER: cqrs
          POSTGRES_PASSWORD: cqrs_secret
          POSTGRES_DB: cqrs_db
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
- CQRS Testing: https://docs.microsoft.com/en-us/azure/architecture/patterns/cqrs#testing