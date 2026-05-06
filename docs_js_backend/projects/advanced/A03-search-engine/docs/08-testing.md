# A03 Search Engine Backend - Testing

## Test Structure

```
tests/
├── unit/
│   ├── tokenizer.test.ts        # Tokenization and stemming
│   ├── bm25.test.ts             # BM25 scoring algorithm
│   ├── highlighter.test.ts      # Term highlighting
│   ├── documentStore.test.ts    # Document storage
│   └── invertedIndex.test.ts    # Inverted index operations
├── integration/
│   ├── search.test.ts           # Search API endpoints
│   ├── documents.test.ts        # Document CRUD endpoints
│   └── bugRegression.test.ts    # Known bug regression tests
```

## Running Tests

```bash
npm test              # Run all tests once
npm run test:watch    # Run in watch mode
npm run test:coverage # Run with coverage report
```

## Unit Tests

### Tokenizer Tests
- Verify text tokenization
- Verify Porter stemming ("running" → "run")
- Verify position tracking

### BM25 Tests
- Verify IDF calculation
- Verify score increases with term frequency
- Verify longer documents are penalized

### Highlighter Tests
- Verify `<mark>` tags are inserted
- Verify case-insensitive matching
- Verify max 3 highlights returned

### Model Tests
- Verify document CRUD operations
- Verify non-blocking reads during writes
- Verify index consistency

## Integration Tests

### Search API
- Full-text search returns relevant results
- Faceted filtering works correctly
- Highlighting returns marked snippets
- Pagination limits results

### Document API
- CRUD operations work correctly
- Validation rejects invalid input
- Concurrent indexing succeeds

## Bug Regression Tests

These tests verify that known bugs do not regress:

### 1. No Inverted Index (O(n) Scan)
**Bug**: Search scans all documents instead of using the index.
**Test**: Index 100 documents, search for unique term. Verify:
- Only matching document returned
- Query completes in <100ms

### 2. Missing Stemmer
**Bug**: Exact match only, "run" doesn't match "running".
**Test**: Index "Running Guide", search for "run". Verify match.

### 3. Blocking Updates
**Bug**: Index updates lock the table, blocking reads.
**Test**: Start indexing large document, verify search still works.

## Coverage Goals

- **Statements**: >90%
- **Branches**: >85%
- **Functions**: >95%
- **Lines**: >90%

## Mocking Strategy

- No external services to mock (in-memory only)
- Time-based tests use Date.now() comparisons
- Concurrent tests use Promise.all()
