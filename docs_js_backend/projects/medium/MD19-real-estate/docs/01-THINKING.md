# Thinking Process: Real Estate Architecture

## Initial Questions

**Q: Why is `ILIKE '%term%'` slow?**
A: B-tree indexes can only do prefix searches (`LIKE 'term%'`). Leading wildcards (`%term%`) require full table scans.

**Q: How do real platforms handle geospatial search?**
A: Zillow uses Elasticsearch with geo_shape. Redfin uses PostgreSQL + PostGIS with GIST indexes.

**Q: Should we use full-text search or trigram indexes?**
A: Full-text search (tsvector) is better for natural language. Trigram (pg_trgm) is better for partial word matches.

## Trade-off Analysis

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Bounding box pre-filter** | Uses B-tree index on lat/lng | Still some app-level filtering | **Phase 1** |
| **PostGIS + GIST** | True geospatial index | Requires extension; more complex | Phase 2 |
| **Trigram index** | Fast fuzzy text search | Requires pg_trgm extension | Phase 2 |
| **Elasticsearch** | Best performance | Adds infrastructure | Phase 3 |

## Search Performance

With 1M listings:
- `ILIKE '%term%'` on address: ~8-15 seconds (full table scan)
- Trigram index: ~50-100ms
- Full-text search: ~20-50ms
- Elasticsearch: ~5-20ms

## Data Flow Sketch

```
Agent creates listing
    |
    v
Listing stored with lat/lng
    |
    v
Buyer searches by location text
    |
    v
Text search (Phase 1: ILIKE; Phase 2: trigram)
    |
    v
Buyer searches "nearby"
    |
    v
Bounding box pre-filter -> exact distance filter
    |
    v
Buyer books tour
    |
    v
Tour scheduled (check for conflicts)
    |
    v
Agent matched by proximity
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Search timeout | High | High | Bounding box pre-filter |
| Memory exhaustion | High | High | Limit fetch-all queries |
| Mortgage calc errors | Medium | High | Unit tests for edge cases |
| Double tour booking | Medium | Medium | Unique constraint |
| Data inconsistency | Low | High | Transactions for updates |
