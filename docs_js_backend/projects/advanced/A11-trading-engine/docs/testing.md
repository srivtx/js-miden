# Testing

## Test Structure

```
tests/
  trading.test.ts   # Order matching and validation tests
```

## Running Tests

```bash
npm test
npm run test:watch
```

## Bug Tests

### Race Condition
```typescript
it('should not allow two buy orders to over-fill a single sell order', async () => {
  // Place sell order for 100
  // Two buyers concurrently request 60 each
  // FAILS: Total traded may exceed 100
});
```

### Price Validation
```typescript
it('should reject orders with negative prices', async () => {
  // Submit order with price = -5
  // FAILS: Order is accepted
});
```

## Load Testing

Use autocannon for concurrency testing:
```bash
npx autocannon -c 100 -d 10 http://localhost:3000/api/orders
```
