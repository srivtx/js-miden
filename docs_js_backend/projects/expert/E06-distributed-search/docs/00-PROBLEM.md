# Problem Statement

Build the backend for a distributed search engine comparable to Elasticsearch or Apache Solr. The system must ingest documents, build an inverted index, parse complex user queries (boolean, phrase, fuzzy), rank results using information retrieval algorithms, and distribute the index across shards with replication awareness.

## Functional Requirements

1. **Document Indexing**: Accept JSON documents, tokenize text fields, build an in-memory inverted index.
2. **Tokenization & Stemming**: Unicode-aware tokenization, lowercasing, stop-word removal, and Porter stemming.
3. **Query Parsing**: Support boolean AND/OR/NOT, phrase queries with slop, and fuzzy matching with edit distance.
4. **Ranking**: TF-IDF and BM25 scoring.
5. **Distribution**: Shard the index by document hash; stub primary-replica replication.
6. **HTTP API**: Express 5 endpoints for index, search, and admin.

## Non-Functional Requirements

- **Latency**: Search should complete in <100ms for small indexes.
- **Consistency**: Index updates should be visible near-instantly (in-memory).
- **Security**: Search results must respect document-level ACLs.

## Known Defect (Intentional Bug)
The search engine returns all matching documents without applying ACL filtering. A user can search for terms present in documents they do not own and receive the full document body. The `acl.ts` service exists but is never invoked in the search hot path.

## Context
This project teaches information retrieval theory, distributed systems partitioning, and the subtle security implications of index design.
