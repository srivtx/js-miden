# Testing

## Test Structure

```
tests/
  feed.test.ts     # Feed and pagination tests
```

## Running Tests

```bash
npm test          # Run all tests
npm run test:watch # Watch mode
```

## Bug Tests

### Fan-out Blocking
```typescript
it('should create posts quickly even with many followers', async () => {
  // Create 1000 followers
  // Measure post creation time
  // FAILS: Fan-out is synchronous
});
```

### Offset Pagination Duplicates
```typescript
it('should not show duplicates when new posts arrive', async () => {
  // Get page 1
  // Add new post
  // Get page 2
  // FAILS: Page 2 contains post from page 1
});
```

## Writing New Tests

1. Reset DB in `beforeEach`
2. Create test data via API
3. Assert expected behavior
4. Run with `npm test`

## Coverage

```bash
npx vitest run --coverage
```
