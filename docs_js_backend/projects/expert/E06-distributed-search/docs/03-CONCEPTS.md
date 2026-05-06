# Core Concepts

## Inverted Index
A data structure that maps from content (terms) to their locations (documents).
- **Dictionary**: The set of unique terms.
- **Posting List**: For each term, a list of postings. A posting is `(docId, tf, positions[])`.
- **Skip Pointers**: Accelerate intersection of posting lists by skipping ahead to common docIds.

## Tokenization
The process of converting a stream of characters into a stream of tokens.
- **Word Boundaries**: Usually whitespace and punctuation.
- **Unicode**: NFC normalization, case folding (e.g., Turkish dotted/dotless i).
- **N-grams**: For CJK languages where word boundaries are ambiguous, character n-grams are used instead of words.

## Stemming
Reducing words to their root form.
- **Porter Stemmer**: Rule-based, fast, over-stems sometimes (e.g., `organization` → `organ`).
- **Snowball**: Successor to Porter, supports multiple languages.
- **Lemmatization**: Uses vocabulary and morphological analysis (better accuracy, slower).

## Boolean Retrieval
- **AND**: Intersection of posting lists.
- **OR**: Union of posting lists.
- **NOT**: Difference (all docs minus term's docs).
Implemented via merge algorithms with docId-sorted lists.

## Phrase Queries
Require terms to appear adjacent. Implemented by intersecting posting lists and checking position offsets. Slop allows a configurable distance (e.g., slop=2 means terms can be 2 positions apart).

## Fuzzy Matching
Levenshtein distance (edit distance) between query term and index term. For small indexes, brute-force scan of dictionary. For large indexes, Levenshtein automata or n-gram indexes are required for performance.

## TF-IDF
`tf(t,d) * idf(t)` where `idf(t) = log(N / df(t))`.
- **tf**: Term frequency in document.
- **df**: Document frequency (number of docs containing term).
- **N**: Total number of documents.

## BM25
A probabilistic ranking function:
`score(D,Q) = sum( idf(q_i) * (f(q_i,D) * (k1 + 1)) / (f(q_i,D) + k1 * (1 - b + b * |D| / avgdl)) )`
- **k1**: Controls term frequency saturation (typically 1.2). Prevents long documents from dominating.
- **b**: Controls document length normalization (typically 0.75).
- **avgdl**: Average document length across the collection.

BM25 improves on TF-IDF by saturating term frequency and normalizing for document length.

## Sharding & Replication
- **Shard**: A partition of the index.
- **Primary**: Handles writes for a shard.
- **Replica**: Read-only copy for failover and query throughput.
- **Routing**: Determine which shard holds a document or needs to be queried.
