# v6 — Switch to ESM

Your search engine has tests, but CommonJS is limiting your tokenizer and query parser. Modern Unicode libraries (Intl.Segmenter) and stemming libraries (natural) are ESM-first.

## Pain #1: Unicode Segmentation

```javascript
// CommonJS
const { Segmenter } = require('intl-segmenter-polyfill');
// Intl.Segmenter is native in Node.js v16+ but only as ESM global
// CommonJS can't access it without globals
```

You want to use `Intl.Segmenter` for proper Unicode word boundaries. In CommonJS, you have to rely on regex-based tokenization which breaks for many languages.

## Pain #2: Stemming Library Updates

```javascript
// CommonJS
const natural = require('natural');
// natural v7+ is ESM-only. You're stuck on v6.
// v6 has incorrect stemming for some edge cases.
```

Your Porter stemmer over-stems "organization" to "organ". You can't update the library to get the fix.

## Pain #3: Query Parser Generator

```typescript
// You want to generate the query parser from a grammar file (PEG.js, nearley)
// The generated parser is ESM. Your CommonJS codebase can't import it.
const parser = require('./generated/query-parser'); // Error
```

You hand-write the recursive descent parser instead of using a generator. It's slower to develop and harder to maintain.

## The Fix: ESM Migration

### package.json

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest",
    "start": "node dist/index.js"
  }
}
```

### Source Files

```typescript
// src/services/tokenizer.ts
import { logger } from '../utils/logger.js';

const segmenter = new Intl.Segmenter('en', { granularity: 'word' });

export function tokenize(text: string, options: { positions?: boolean } = {}): Token[] {
  const segments = segmenter.segment(text);
  const tokens: Token[] = [];
  
  for (const segment of segments) {
    if (segment.isWordLike) {
      const normalized = segment.segment.toLowerCase().normalize('NFC');
      if (!isStopWord(normalized)) {
        tokens.push(options.positions
          ? { term: stem(normalized), position: segment.index }
          : stem(normalized)
        );
      }
    }
  }
  
  return tokens;
}
```

```typescript
// src/services/queryParser.ts
import { QueryNode } from '../types/search.js';
import { logger } from '../utils/logger.js';

// Generated from grammar (PEG.js)
import { parse as parseGrammar } from './generated/query-parser.js';

export function parseQuery(query: string): QueryNode {
  if (query.length > 500) {
    throw new Error('Query too long');
  }
  
  try {
    return parseGrammar(query);
  } catch (error: any) {
    logger.warn({ query, error: error.message }, 'Query parse failed');
    // Fallback to simple term query
    return { type: 'term', term: query.toLowerCase() };
  }
}
```

```typescript
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
      (pl.documentFrequency + 0.5) + 1
    );
    
    const tf = posting.tf;
    const numerator = tf * (params.k1 + 1);
    const denominator = tf + params.k1 * (1 - params.b + params.b * (docLength / params.avgdl));
    
    score += idf * (numerator / denominator);
  }
  
  return score;
}
```

## What Changed

1. **Unicode tokenization** — `Intl.Segmenter` for proper word boundaries.
2. **Modern stemming** — Latest natural.js with bug fixes.
3. **Generated parsers** — Grammar-based query parser imports cleanly.
4. **Type-safe ranking** — BM25 types are pure ESM imports.

## ESM for Search Engines

In information retrieval, text processing is everything. ESM gives you access to:
- **Latest NLP libraries** — Tokenizers, stemmers, lemmatizers
- **Unicode standards** — Proper segmentation for 100+ languages
- **Grammar tools** — Parser generators for complex query languages
- **Performance** — Tree shaking removes unused text processing code

## Next Pain

The search engine runs but has no graceful shutdown. Index updates are lost on restart. In-flight queries are dropped. You need production setup.
