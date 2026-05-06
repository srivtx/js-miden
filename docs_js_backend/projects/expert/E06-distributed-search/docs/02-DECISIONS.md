# Architecture Decisions

## ADR-001: In-Memory Inverted Index
- **Status**: Accepted
- **Context**: Educational clarity and low latency for small corpora.
- **Decision**: Store index in `Map<string, PostingList>` in Node.js heap.
- **Consequences**: Limited by single-node RAM. No persistence across restarts. Not suitable for production scale.

## ADR-002: Document-Based Sharding
- **Status**: Accepted
- **Context**: Read-heavy search workload.
- **Decision**: Shard by `hash(docId) % numShards`.
- **Consequences**: Even distribution. Cross-shard queries require fan-out and merge. Adding shards requires reindexing.

## ADR-003: Recursive-Descent Query Parser
- **Status**: Accepted
- **Context**: Need boolean logic with correct operator precedence.
- **Decision**: Hand-written recursive-descent parser instead of regex hacks or splitting by spaces.
- **Consequences**: Correct precedence, extensible to new query types, but more code to maintain.

## ADR-004: BM25 as Default Ranker
- **Status**: Accepted
- **Context**: BM25 outperforms TF-IDF on most text retrieval benchmarks.
- **Decision**: Rank with BM25(k1=1.2, b=0.75). Expose TF-IDF for educational comparison.
- **Consequences**: Better relevance, but requires tracking average document length across the collection.

## ADR-005: ACL Service Stub (Unwired)
- **Status**: Intentional Defect
- **Context**: ACL module exists but is not called in search path.
- **Decision**: Document the stub but leave it unintegrated.
- **Consequences**: Unauthorized document leakage.
