# Testing Guide

## Test Structure

```
tests/
├── setup.ts
└── app.test.ts
```

## Running Tests

```bash
npm test
npm test -- --watch
npm test -- --coverage
```

## Test Categories

- Course CRUD operations
- Enrollment flow
- Progress tracking
- Quiz submission
- Bug regression tests

## CI/CD

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
