# A04 Payment Orchestrator - Testing

## Test Structure

```
tests/
├── unit/
│   ├── circuitBreaker.test.ts   # Circuit breaker state transitions
│   └── paymentStore.test.ts     # Payment storage operations
├── integration/
│   ├── payments.test.ts         # Payment CRUD and fallback
│   ├── webhooks.test.ts         # Webhook handling
│   ├── reconciliation.test.ts   # Reconciliation process
│   └── bugRegression.test.ts    # Known bug regression tests
```

## Running Tests

```bash
npm test              # Run all tests once
npm run test:watch    # Run in watch mode
npm run test:coverage # Run with coverage report
```

## Unit Tests

### Circuit Breaker Tests
- Verify closed state allows requests
- Verify open state rejects requests
- Verify half-open state after timeout
- Verify transition back to closed after successes

### Payment Store Tests
- Verify CRUD operations
- Verify idempotency key lookup
- Verify provider transaction ID lookup
- Verify status and date range filtering

## Integration Tests

### Payment API Tests
- Create payment succeeds
- Validation rejects invalid input
- Fallback to secondary provider works
- All providers failing returns failed status
- Idempotency prevents duplicates
- Refund works for succeeded payments

### Webhook API Tests
- Stripe webhook updates payment status
- PayPal webhook updates payment status
- Missing signature returns 400
- Non-existent transaction returns 404

### Reconciliation Tests
- Reconcile today's payments
- Detect status discrepancies
- Generate correct report format

## Bug Regression Tests

These tests verify that known bugs do not regress:

### 1. No Fallback
**Bug**: If primary provider fails, all payments fail.
**Test**: Force Stripe to fail, verify PayPal succeeds.

### 2. No Idempotency
**Bug**: Retrying a payment creates duplicate charges.
**Test**: Send same request 3 times, verify same payment ID.

### 3. Webhook Cross-Contamination
**Bug**: Stripe webhook updates PayPal payment (or vice versa).
**Test**: 
- Create PayPal payment
- Send Stripe webhook with PayPal transaction ID
- Verify 404 response
- Verify PayPal payment status unchanged

## Coverage Goals

- **Statements**: >90%
- **Branches**: >85%
- **Functions**: >95%
- **Lines**: >90%

## Mock Strategy

### Provider Mocking

Both Stripe and PayPal providers are mocks with configurable failure rates:

```typescript
// Force provider to always fail
stripeProvider.setFailureRate(1.0);

// Force provider to always succeed
stripeProvider.setFailureRate(0.0);

// 50% failure rate
stripeProvider.setFailureRate(0.5);
```

### Webhook Signature Mocking

Signatures are computed deterministically for tests:

```typescript
const signature = `stripe_${Buffer.from(JSON.stringify(payload))
  .toString('base64')
  .slice(0, 20)}`;
```

## CI/CD Pipeline

Recommended GitHub Actions workflow:

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run build
```
