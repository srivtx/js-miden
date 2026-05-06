# Testing Guide

## Test Structure

```
tests/
├── setup.ts           # Test configuration
├── app.test.ts        # Main test suite
└── unit/              # Unit tests (if needed)
```

## Running Tests

```bash
# Run all tests
npm test

# Run with watch mode
npm test -- --watch

# Run specific file
npm test -- tests/app.test.ts

# Run with coverage
npm test -- --coverage

# Run with UI
npm test -- --ui
```

## Test Environment

Tests use a separate database (`food_delivery_test`) to avoid polluting development data.

## Test Categories

### Integration Tests

Test full API endpoints:
- Restaurant CRUD operations
- Order creation and lifecycle
- Driver assignment
- Tracking updates

### Bug Regression Tests

Specific tests for known bugs:
- Race condition in driver assignment
- Inventory bypass on order creation

## Writing New Tests

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Feature', () => {
  it('should do something', async () => {
    const res = await request(app)
      .get('/api/endpoint')
      .expect(200);
    
    expect(res.body.data).toBeDefined();
  });
});
```

## Test Data

Tests create their own data in `beforeAll` hooks and clean up in `afterAll`. This ensures test isolation.

## Mocking

Use Vitest's built-in mocking:

```typescript
import { vi } from 'vitest';

vi.mock('../src/services/external', () => ({
  externalService: vi.fn().mockResolvedValue({ success: true })
}));
```

## Continuous Integration

Example GitHub Actions workflow:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
```
