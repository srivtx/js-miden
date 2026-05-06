# v4 — Add Logging

Your search engine indexes documents, parses queries, and ranks results. When search returns garbage or leaks unauthorized documents, you have no record of what the query was or how it was evaluated.

## Pain #1: Ranking Mysteries

```typescript
// services/searchEngine.ts (before)
function search(query: string, options: SearchOptions) {
  console.log('Searching for:', query);
  const tokens = tokenizer.tokenize(query);
  const ast = queryParser.parse(tokens);
  const results = ranker.rank(ast, index);
  console.log('Found', results.length, 'results');
  return results;
}
```

A user reports wrong results for "machine learning". The log says `"Found 5 results"` but not:
- How the query was tokenized
- The AST structure
- Which posting lists were queried
- The BM25 scores for each result
- Whether ACL filtering was applied

## Pain #2: Index Corruption Without Trace

```typescript
// services/indexManager.ts (before)
function addDocument(doc: Document) {
  console.log('Indexing document', doc.id);
  const tokens = tokenizer.tokenize(doc.title + ' ' + doc.content);
  for (const token of tokens) {
    index.add(token, doc.id);
  }
}
```

Search results are duplicated. The log shows documents were indexed but not:
- The exact tokens generated
- Whether duplicates were detected
- The posting list state before and after
- Which shard received the document

## Pain #3: ACL Leaks Without Detection

```typescript
// services/searchEngine.ts (before)
function search(query: string, userId: string) {
  console.log('Search by user:', userId);
  const results = ranker.rank(query, index);
  // ACL filtering is supposed to happen here but doesn't
  return results;
}
```

A user sees documents they don't own. The log shows the search happened but not:
- The user's ACL groups
- The document ACLs that should have been checked
- Whether the filter was applied
- The unfiltered vs filtered result counts

## The Fix: Structured Logging with Query Context

```typescript
// src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'search',
    version: process.env.SERVICE_VERSION,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createSearchLogger(query: string, userId: string) {
  return logger.child({ query, userId, context: 'search' });
}

export function createIndexLogger(documentId: string) {
  return logger.child({ documentId, context: 'index' });
}
```

```typescript
// src/services/searchEngine.ts
import { logger, createSearchLogger } from '../utils/logger.js';

export function search(query: string, options: SearchOptions): SearchResult[] {
  const log = createSearchLogger(query, options.userId);
  const startTime = Date.now();
  
  log.info('Search started');
  
  // 1. Parse query
  const tokens = tokenizer.tokenize(query);
  log.debug({ tokens }, 'Query tokenized');
  
  const ast = queryParser.parse(tokens);
  log.debug({ ast: serializeAst(ast) }, 'Query parsed');
  
  // 2. Execute search
  const rawResults = indexManager.query(ast);
  log.info({ rawCount: rawResults.length }, 'Raw results retrieved');
  
  // 3. Apply ACL filtering
  const filteredResults = aclFilter(rawResults, options.userId);
  log.info({
    filteredCount: filteredResults.length,
    filteredOut: rawResults.length - filteredResults.length,
  }, 'ACL filtering applied');
  
  // 4. Rank results
  const rankedResults = ranker.rank(filteredResults, ast, options.userId);
  log.info({
    resultCount: rankedResults.length,
    topScore: rankedResults[0]?.score,
    durationMs: Date.now() - startTime,
  }, 'Search completed');
  
  return rankedResults;
}
```

```typescript
// src/services/indexManager.ts
import { logger, createIndexLogger } from '../utils/logger.js';

export function addDocument(doc: Document): void {
  const log = createIndexLogger(doc.id);
  log.info({ title: doc.title, acl: doc.acl }, 'Document indexing started');
  
  const tokens = tokenizer.tokenize(doc.title + ' ' + doc.content);
  const uniqueTokens = new Set(tokens);
  
  log.debug({ tokenCount: tokens.length, uniqueTokenCount: uniqueTokens.size }, 'Tokens generated');
  
  for (const token of uniqueTokens) {
    const postingList = index.get(token) || { term: token, postings: [], documentFrequency: 0 };
    const existing = postingList.postings.find(p => p.docId === doc.id);
    
    if (existing) {
      log.warn({ token }, 'Duplicate document in posting list');
    } else {
      postingList.postings.push({
        docId: doc.id,
        tf: tokens.filter(t => t === token).length,
        positions: tokens.map((t, i) => t === token ? i : -1).filter(i => i !== -1),
      });
      postingList.documentFrequency++;
      index.set(token, postingList);
    }
  }
  
  log.info({ indexedTokens: uniqueTokens.size }, 'Document indexed');
}
```

## Log Output Example

```json
{
  "level": 30,
  "time": "2025-01-15T13:50:18.777Z",
  "service": "search",
  "version": "2.0.1",
  "query": "machine learning",
  "userId": "user_123",
  "context": "search",
  "rawCount": 47,
  "filteredCount": 12,
  "filteredOut": 35,
  "resultCount": 10,
  "topScore": 8.45,
  "durationMs": 23,
  "msg": "Search completed"
}
```

## What Changed

1. **Query transparency** — Tokenization, parsing, and ranking are fully logged.
2. **ACL audit** — Filtered-out count proves filtering happened.
3. **Index integrity** — Duplicates are detected and logged.
4. **Performance tracking** — Every search logs duration and result counts.

## Logging as Relevance Debugging

Search quality is subjective. When users complain about bad results, logs are the only way to prove whether the ranking algorithm or the ACL filter is at fault. Without structured logs, search debugging is guesswork.

## Next Pain

You fix the ACL filtering bug. But you have no test that verifies a user can't search documents they don't own. A future refactor might remove the filter again. You need automated testing.
