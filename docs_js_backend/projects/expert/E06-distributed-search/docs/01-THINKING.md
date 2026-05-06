# Design Thinking

## 1. Index Data Structure
An inverted index maps terms to posting lists. The posting list contains document IDs, term frequencies, and positions.

Options:
- **Hash map**: O(1) term lookup, but high memory overhead for large vocabularies.
- **B-tree**: Good for disk-based indexes, slower in-memory.
- **Trie / FST**: Excellent for prefix and fuzzy queries, complex to implement.

Decision: Use a `Map<string, PostingList>` for clarity. Production would use Lucene's Finite State Transducer or RocksDB for persistence.

## 2. Tokenization Pipeline
Text → Tokenizer → Filter Chain → Terms.

- **Tokenizer**: Regex-based word boundary splitting. Unicode support is ideal but we stub ASCII for simplicity.
- **Lowercase Filter**: Normalizes case.
- **Stop Word Filter**: Removes high-frequency words (the, and, is).
- **Stemmer**: Reduces inflected words to root form (running → run).

Decision: Implement a simple regex tokenizer and a lightweight Porter stemmer. This avoids heavy NLP dependencies while teaching the concepts.

## 3. Query Language
We need a mini query DSL.

- **Boolean**: `java AND (backend OR server) NOT frontend`
- **Phrase**: `"distributed systems"~2` (slop 2)
- **Fuzzy**: `colr~1` matches `color` with edit distance 1.

Decision: Build a recursive-descent parser for boolean expressions. Phrase and fuzzy are handled as term modifiers. This is more robust than regex-based parsing.

## 4. Ranking Model
- **TF-IDF**: Classic baseline. Easy to explain but doesn't account for document length.
- **BM25**: Probabilistic model with term saturation and length normalization. State-of-the-art for bag-of-words retrieval.

Decision: Implement both. BM25 as default, TF-IDF as fallback for comparison.

## 5. Sharding
How to partition the index?

- **Term-based**: Each shard owns a subset of terms. Good for write-heavy, bad for read-heavy (every query hits all shards).
- **Document-based**: Each shard owns a subset of documents. Good for read-heavy, easy to scale.

Decision: Document-based sharding via `hash(docId) % numShards`. This is what Elasticsearch uses.

## 6. ACL Integration
Where should ACL checks happen?

- **Index time**: Add `allowedUsers` to each posting. Filters at the posting-list level (fastest).
- **Query time**: Fetch all results, then post-filter through ACL service (simpler, slower).

Decision: We stub a query-time ACL service but intentionally forget to wire it into the search path.
