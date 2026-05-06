# v3 — Add Validation

Your search engine accepts documents and queries from external users. Without validation, malformed input corrupts the index, crashes the query parser, or leaks unauthorized data.

## Pain #1: Document Corruption

```typescript
// routes/search.ts (before)
app.post('/documents', (req, res) => {
  const doc = { id: req.body.id, ...req.body };
  indexManager.addDocument(doc);
  res.status(201).json(doc);
});
```

A user sends `{ id: { $ne: null }, content: { toString: () => 'infinite loop' } }`. The tokenizer calls `content.split()` on an object. It throws. The index is in an inconsistent state.

## Pain #2: Query Injection

```typescript
app.get('/search', (req, res) => {
  const query = req.query.q;
  const results = queryParser.parse(query);
  // query might be 10MB of nested parentheses
  // The recursive parser hits stack overflow
});
```

A user sends `q=((((...5000 parens...))))`. The recursive descent parser exhausts the call stack. The search service crashes. All concurrent queries fail.

## Pain #3: Invalid BM25 Parameters

```typescript
// routes/admin.ts
app.post('/index/config', (req, res) => {
  const { k1, b } = req.body;
  indexManager.setBM25Params({ k1, b });
  // k1 might be 0. Division by zero in BM25.
  // b might be 2.0. Scores become negative.
});
```

A buggy admin client sends `k1: 0`. BM25 divides by zero. All scores are `NaN`. Results are in random order.

## The Fix: Zod at Ingest and Query Boundaries

```typescript
// src/validation/search.ts
import { z } from 'zod';

export const DocumentSchema = z.object({
  id: z.string().min(1).max(256),
  title: z.string().min(1).max(1000),
  content: z.string().min(0).max(100000),
  acl: z.array(z.string().min(1)).min(1), // At least one owner
  createdAt: z.string().datetime().optional(),
});

export const QuerySchema = z.string().min(1).max(500);

export const SearchParamsSchema = z.object({
  q: QuerySchema,
  from: z.number().int().min(0).default(0),
  size: z.number().int().min(1).max(100).default(10),
  userId: z.string().min(1),
});

export const BM25ConfigSchema = z.object({
  k1: z.number().min(0.1).max(3.0).default(1.2),
  b: z.number().min(0.0).max(1.0).default(0.75),
});
```

```typescript
// src/routes/search.ts
import { DocumentSchema, SearchParamsSchema } from '../validation/search.js';

app.post('/documents', authenticate, validateBody(DocumentSchema), (req, res) => {
  const doc = req.body;
  // Guaranteed: id is string, title is string, content is string
  // Guaranteed: acl has at least one entry
  indexManager.addDocument(doc);
  res.status(201).json(doc);
});

app.get('/search', authenticate, validateQuery(SearchParamsSchema), (req, res) => {
  const { q, from, size, userId } = req.query;
  // Guaranteed: q is 1-500 chars, size is 1-100
  const results = searchEngine.search(q, { from, size, userId });
  res.json(results);
});
```

```typescript
// src/services/queryParser.ts
const MAX_QUERY_DEPTH = 50;

export function parseQuery(query: string): QueryNode {
  if (query.length > 500) {
    throw new Error('Query too long');
  }
  
  const tokens = tokenize(query);
  const ast = parseExpression(tokens, 0);
  
  if (ast.depth > MAX_QUERY_DEPTH) {
    throw new Error('Query too complex');
  }
  
  return ast;
}
```

## What Changed

1. **Document integrity** — `content` must be a string. No object injection.
2. **Query safety** — Max 500 chars, max depth 50. No stack overflow.
3. **BM25 correctness** — `k1` >= 0.1, `b` 0-1. No division by zero.
4. **ACL enforcement** — Every document must have at least one owner.

## Validation as Index Protection

The inverted index is the heart of the search engine. One corrupt document poisons posting lists for every term it contains. Validation at ingestion protects the entire index.

## Next Pain

When the query parser throws on a complex query, you have no record of what the user sent. Logs are `console.log` scattered across files. You need structured logging.
