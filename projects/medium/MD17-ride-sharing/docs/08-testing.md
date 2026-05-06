# Testing Guide

## Test Structure

```
tests/
├── setup.ts           # Test configuration
└── app.test.ts        # Main test suite
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
```

## Test Categories

### Integration Tests
- Ride CRUD operations
- Driver acceptance flow
- Fare calculation
- Review submission

### Bug Regression Tests
- Surge pricing atomicity
- Stale location updates

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

Tests create their own data in `beforeAll` hooks and clean up in `afterAll`.

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
