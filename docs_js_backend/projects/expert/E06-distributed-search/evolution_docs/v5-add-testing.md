# v5 — Add Testing

Your search engine has logging, but ranking bugs and ACL leaks reach production. A tokenizer change breaks phrase queries. A shard rebalance duplicates results. You need confidence in every query.

## Pain #1: Tokenizer Regressions

You add support for CJK (Chinese, Japanese, Korean) tokenization. The change works for CJK but breaks English phrase queries. "Machine learning" is now tokenized as `["machine", "learning"]` instead of `["machine", " ", "learning"]`. Phrase matching fails silently.

## Pain #2: Ranking Score Drift

You optimize BM25 scoring for performance. The new code caches IDF values. But the cache is never invalidated when new documents are added. Search results for common terms slowly degrade as the index grows.

## Pain #3: ACL Filtering Omission

You refactor search to use a new aggregation pipeline. The pipeline builder forgets to add the `$match` stage for ACL filtering. For two weeks, users see documents from other organizations. No test catches it because there are no ACL tests.

## The Fix: Layered Testing Strategy

### Unit Tests: Tokenization

```typescript
// tests/unit/tokenizer.test.ts
import { describe, it, expect } from 'vitest';
import { tokenize } from '../../src/services/tokenizer.js';

describe('Tokenization', () => {
  it('should tokenize English text', () => {
    const tokens = tokenize('Hello, world!');
    expect(tokens).toEqual(['hello', 'world']);
  });
  
  it('should handle stemming', () => {
    const tokens = tokenize('running runners run');
    expect(tokens).toEqual(['run', 'run', 'run']);
  });
  
  it('should remove stop words', () => {
    const tokens = tokenize('the quick brown fox');
    expect(tokens).not.toContain('the');
    expect(tokens).toContain('quick');
  });
  
  it('should handle phrase queries with positions', () => {
    const tokens = tokenize('machine learning', { positions: true });
    expect(tokens).toEqual([
      { term: 'machin', position: 0 },
      { term: 'learn', position: 1 },
    ]);
  });
  
  it('should handle CJK text', () => {
    const tokens = tokenize('机器学习');
    expect(tokens.length).toBeGreaterThan(0);
    // CJK uses character n-grams
    expect(tokens.every(t => t.length <= 3)).toBe(true);
  });
  
  it('should handle mixed language text', () => {
    const tokens = tokenize('machine learning 机器学习');
    expect(tokens).toContain('machin');
    expect(tokens).toContain('learn');
    expect(tokens.length).toBeGreaterThan(2); // CJK tokens too
  });
});
```

### Unit Tests: Query Parsing

```typescript
// tests/unit/queryParser.test.ts
import { describe, it, expect } from 'vitest';
import { parseQuery } from '../../src/services/queryParser.js';

describe('Query parsing', () => {
  it('should parse simple term', () => {
    const ast = parseQuery('hello');
    expect(ast.type).toBe('term');
    expect(ast.term).toBe('hello');
  });
  
  it('should parse AND query', () => {
    const ast = parseQuery('machine AND learning');
    expect(ast.type).toBe('and');
    expect(ast.left.type).toBe('term');
    expect(ast.right.type).toBe('term');
  });
  
  it('should parse OR query', () => {
    const ast = parseQuery('machine OR learning');
    expect(ast.type).toBe('or');
  });
  
  it('should parse NOT query', () => {
    const ast = parseQuery('NOT machine');
    expect(ast.type).toBe('not');
    expect(ast.child.type).toBe('term');
  });
  
  it('should parse phrase query', () => {
    const ast = parseQuery('"machine learning"');
    expect(ast.type).toBe('phrase');
    expect(ast.terms).toEqual(['machine', 'learning']);
    expect(ast.slop).toBe(0);
  });
  
  it('should parse phrase with slop', () => {
    const ast = parseQuery('"machine learning"~2');
    expect(ast.type).toBe('phrase');
    expect(ast.slop).toBe(2);
  });
  
  it('should parse fuzzy query', () => {
    const ast = parseQuery('hello~2');
    expect(ast.type).toBe('fuzzy');
    expect(ast.term).toBe('hello');
    expect(ast.distance).toBe(2);
  });
  
  it('should reject overly complex queries', () => {
    const deepQuery = 'a AND '.repeat(100) + 'b';
    expect(() => parseQuery(deepQuery)).toThrow('Query too complex');
  });
});
```

### Unit Tests: BM25 Scoring

```typescript
// tests/unit/ranker.test.ts
import { describe, it, expect } from 'vitest';
import { bm25Score } from '../../src/services/ranker.js';

describe('BM25 scoring', () => {
  const params = { k1: 1.2, b: 0.75, avgdl: 100 };
  
  it('should score exact matches higher', () => {
    const docA = { id: '1', title: 'machine', content: 'machine learning' };
    const docB = { id: '2', title: 'other', content: 'other topic' };
    
    const postingLists = [{
      term: 'machine',
      postings: [
        { docId: '1', tf: 2, positions: [0, 1] },
        { docId: '2', tf: 0, positions: [] },
      ],
      documentFrequency: 1,
    }];
    
    const scoreA = bm25Score(docA, postingLists, params);
    const scoreB = bm25Score(docB, postingLists, params);
    
    expect(scoreA).toBeGreaterThan(scoreB);
  });
  
  it('should penalize long documents', () => {
    const shortDoc = { id: '1', title: 'machine', content: 'machine' };
    const longDoc = { id: '2', title: 'machine', content: 'machine '.repeat(100) };
    
    const postingLists = [{
      term: 'machine',
      postings: [
        { docId: '1', tf: 1, positions: [0] },
        { docId: '2', tf: 100, positions: Array.from({ length: 100 }, (_, i) => i) },
      ],
      documentFrequency: 2,
    }];
    
    const shortScore = bm25Score(shortDoc, postingLists, params);
    const longScore = bm25Score(longDoc, postingLists, params);
    
    // Same term frequency ratio, but long doc should score lower per-occurrence
    expect(shortScore / 1).toBeGreaterThan(longScore / 100);
  });
  
  it('should handle empty posting lists', () => {
    const doc = { id: '1', title: 'test', content: 'test' };
    const score = bm25Score(doc, [], params);
    expect(score).toBe(0);
  });
});
```

### Integration Tests: ACL Filtering

```typescript
// tests/integration/acl.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { setupSearchEngine } from '../helpers/test-engine.js';

let engine: any;

describe('ACL filtering', () => {
  beforeAll(async () => {
    engine = await setupSearchEngine();
    
    // Index documents with different ACLs
    await engine.index({
      id: 'doc-1',
      title: 'Public document',
      content: 'Everyone can see this',
      acl: ['user-a', 'user-b'],
    });
    
    await engine.index({
      id: 'doc-2',
      title: 'Private document',
      content: 'Only owner can see this',
      acl: ['user-b'],
    });
    
    await engine.index({
      id: 'doc-3',
      title: 'Admin document',
      content: 'Admin only',
      acl: ['user-c'],
    });
  });
  
  it('should return documents user has access to', async () => {
    const results = await engine.search('document', { userId: 'user-a' });
    const ids = results.map((r: any) => r.docId);
    expect(ids).toContain('doc-1');
    expect(ids).not.toContain('doc-2');
    expect(ids).not.toContain('doc-3');
  });
  
  it('should return multiple accessible documents', async () => {
    const results = await engine.search('document', { userId: 'user-b' });
    const ids = results.map((r: any) => r.docId);
    expect(ids).toContain('doc-1');
    expect(ids).toContain('doc-2');
    expect(ids).not.toContain('doc-3');
  });
  
  it('should return no results for user with no access', async () => {
    const results = await engine.search('document', { userId: 'user-d' });
    expect(results).toHaveLength(0);
  });
  
  it('should NOT leak document content in results', async () => {
    const results = await engine.search('Private', { userId: 'user-a' });
    const doc2 = results.find((r: any) => r.docId === 'doc-2');
    expect(doc2).toBeUndefined();
  });
});
```

### Integration Tests: Sharding

```typescript
// tests/integration/sharding.test.ts
import { describe, it, expect } from 'vitest';
import { IndexManager } from '../../src/services/indexManager.js';

describe('Index sharding', () => {
  it('should distribute documents across shards', () => {
    const manager = new IndexManager({ shardCount: 3 });
    
    const docIds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    for (const id of docIds) {
      manager.addDocument({ id, title: `Doc ${id}`, content: 'test', acl: ['user-1'] });
    }
    
    const shardDistribution = manager.getShardDistribution();
    expect(shardDistribution.length).toBe(3);
    expect(shardDistribution.every(s => s.docCount > 0)).toBe(true);
  });
  
  it('should query all shards and merge results', async () => {
    const manager = new IndexManager({ shardCount: 3 });
    
    await manager.addDocument({ id: '1', title: 'alpha', content: 'test', acl: ['user-1'] });
    await manager.addDocument({ id: '2', title: 'beta', content: 'test', acl: ['user-1'] });
    await manager.addDocument({ id: '3', title: 'gamma', content: 'test', acl: ['user-1'] });
    
    const results = await manager.search('alpha OR beta OR gamma', { userId: 'user-1' });
    expect(results).toHaveLength(3);
  });
});
```

## What Changed

1. **Tokenizer correctness** — English, CJK, mixed language, phrase positions.
2. **Query parsing** — AND, OR, NOT, phrase, fuzzy, complexity limits.
3. **Ranking accuracy** — Exact matches, length normalization, edge cases.
4. **ACL security** — Users only see documents they own. No leaks.
5. **Shard distribution** — Documents spread evenly. Queries merge correctly.

## Testing as Search Quality Assurance

Search quality is the product. A test that verifies "machine learning" ranks higher than "learning machine" is not academic — it's the user experience. ACL tests are security requirements. Without them, every refactor risks leaking private data.

## Next Pain

Tests run but the codebase uses CommonJS. Dynamic imports for test fixtures are awkward. You need ESM for cleaner test code.
