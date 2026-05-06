# Old vs New Approaches

## The Old Way: SQL LIKE and Full-Text Extensions
Early search used `SELECT * FROM docs WHERE content LIKE '%word%'`.
- **No ranking**: Results are unordered.
- **Slow**: O(n) table scan per query.
- **No boolean logic**: `LIKE` cannot express AND/OR/NOT naturally.
- **No phrase support**: Adjacency is impossible.
- **No fuzzy matching**: Typos return zero results.

## The New Way: Inverted Index with Probabilistic Ranking
Modern search engines use inverted indexes and advanced ranking.
- **O(1) term lookup**: Dictionary hash map.
- **Relevance ranking**: TF-IDF, BM25, and now vector search (embeddings).
- **Complex queries**: Boolean, phrase, fuzzy, range, geospatial.
- **Distributed**: Shards and replicas scale horizontally.
- **Real-time**: Near-instant indexing with segment merging.

## Comparison Table

| Feature | SQL LIKE | Inverted Index |
|---------|----------|----------------|
| Ranking | None | TF-IDF / BM25 |
| Boolean | Manual AND/OR | Native posting list ops |
| Phrase | Impossible | Position-aware intersection |
| Fuzzy | Impossible | Edit distance / n-grams |
| Scale | Vertical only | Horizontal sharding |
| Relevance | Zero | High |

## The Evolution Path
1. **String matching**: `LIKE '%term%'`.
2. **Full-text index**: MySQL FULLTEXT, PostgreSQL tsvector.
3. **Dedicated search**: Elasticsearch, Solr, OpenSearch.
4. **Vector search**: Pinecone, Weaviate, Elasticsearch kNN.
