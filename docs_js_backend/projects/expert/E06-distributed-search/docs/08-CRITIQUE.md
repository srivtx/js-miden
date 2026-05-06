# Critique

## Strengths
1. **IR Theory Coverage**: Implements core concepts (inverted index, TF-IDF, BM25, boolean queries) rather than abstracting them away.
2. **Distributed Concepts**: Sharding and replication stubs teach horizontal scaling even though the implementation is single-node.
3. **Modular Parser**: The recursive-descent query parser is extensible to new syntax (range queries, wildcards).

## Weaknesses
1. **In-Memory Only**: No persistence or transaction log. A crash loses all indexed data.
2. **No Concurrency Control**: Simultaneous index updates could corrupt the in-memory maps.
3. **Naive Fuzzy Matching**: Brute-force Levenshtein over the entire dictionary is O(vocabulary * termLength^2). Unusable beyond a few thousand terms.
4. **BM25 Stub**: Parameter tuning (k1, b) is hardcoded. Real systems A/B test these.
5. **No Result Caching**: Repeated identical queries recompute intersections and scores.
6. **ACL is an Afterthought**: Post-filtering is inefficient. Index-time ACL (filtering posting lists) is the correct architecture.

## What We Would Do Differently
- Add a write-ahead log (WAL) for index durability.
- Implement skip pointers in posting lists for faster boolean intersections.
- Use a finite-state transducer (FST) for the dictionary to support prefix and fuzzy queries efficiently.
- Integrate ACL at the posting-list level rather than post-filtering.
- Add a query result cache (LRU) with invalidation on index updates.
