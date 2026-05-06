# v2 — Add TypeScript

Your search engine builds inverted indexes, parses queries, ranks results, and shards data. JavaScript's lack of types is causing index corruption and ranking bugs.

## Pain #1: Posting List Corruption

```js
// services/indexManager.js
function addToIndex(term, docId, position) {
  if (!index[term]) index[term] = [];
  index[term].push({ docId, tf: 1, positions: [position] });
}
```

A caller passes `docId` as a number in one place and a string in another. `'42'` !== `42`. The same document appears twice in the index. Search results are duplicated.

## Pain #2: Query Parser Ambiguity

```js
// services/queryParser.js
function parseQuery(query) {
  // Returns { type: 'AND' | 'OR' | 'NOT', terms: string[] }
  // But sometimes returns { type: 'PHRASE', terms: string[], slop: number }
  // And sometimes returns { type: 'FUZZY', term: string, distance: number }
}
```

The search engine checks `query.terms` for a fuzzy query. It's `undefined`. The engine crashes. Users see a 500.

## Pain #3: BM25 Parameter Chaos

```js
// services/ranker.js
function bm25Score(doc, query, params) {
  const k1 = params.k1 || 1.2;
  const b = params.b || 0.75;
  // params might be undefined. k1 becomes NaN. Score is NaN.
  // All results sort to the end.
}
```

Ranking returns `NaN` for every document. Results are in random order. Users think the search is broken.

## The Fix: TypeScript

```ts
// src/types/search.ts
export interface Posting {
  docId: string;
  tf: number;
  positions: number[];
}

export interface PostingList {
  term: string;
  postings: Posting[];
  documentFrequency: number;
}

export type QueryNode =
  | { type: 'term'; term: string }
  | { type: 'and'; left: QueryNode; right: QueryNode }
  | { type: 'or'; left: QueryNode; right: QueryNode }
  | { type: 'not'; child: QueryNode }
  | { type: 'phrase'; terms: string[]; slop: number }
  | { type: 'fuzzy'; term: string; distance: number };

export interface BM25Params {
  k1: number;
  b: number;
  avgdl: number;
}

export interface SearchResult {
  docId: string;
  score: number;
  highlights: string[];
}

export interface Document {
  id: string;
  title: string;
  content: string;
  acl: string[]; // list of user IDs who can access
  createdAt: Date;
}
```

```ts
// src/services/ranker.ts
import { BM25Params, PostingList, Document } from '../types/search.js';

export function bm25Score(
  doc: Document,
  postingLists: PostingList[],
  params: BM25Params
): number {
  let score = 0;
  const docLength = doc.title.length + doc.content.length;

  for (const pl of postingLists) {
    const posting = pl.postings.find(p => p.docId === doc.id);
    if (!posting) continue;

    const idf = Math.log(
      (totalDocs - pl.documentFrequency + 0.5) /
      (pl.documentFrequency + 0.5) +
      1
    );

    const tf = posting.tf;
    const numerator = tf * (params.k1 + 1);
    const denominator =
      tf + params.k1 * (1 - params.b + params.b * (docLength / params.avgdl));

    score += idf * (numerator / denominator);
  }

  return score;
}
```

## What Changed

1. **Posting list integrity** — `docId` is always `string`. No number/string mismatch.
2. **Query AST** — `QueryNode` is a discriminated union. Every variant is handled.
3. **BM25 safety** — `params` is required. `k1` and `b` are numbers. No `NaN`.
4. **Search result contract** — `score` is always a number. Highlights are strings.

## Trade-Offs

- **Union type complexity** — `QueryNode` requires type guards at every parse step
- **Performance** — TypeScript adds no runtime overhead, but compilation takes time
- **Generic documents** — `Document` has a fixed shape; user-defined fields need generics or `Record<string, unknown>`

## Migration Path

```bash
# 1. Define search types
mkdir src/types
# Posting, PostingList, QueryNode, BM25Params, SearchResult, Document

# 2. Type the index first (data foundation)
# indexManager.ts → tokenizer.ts → queryParser.ts → ranker.ts

# 3. Add strict checks
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

## Result

Index corruption from type mismatches is eliminated. Query parsing handles all node types exhaustively. BM25 scores are always valid numbers. The search pipeline is type-safe from ingestion to ranking.
