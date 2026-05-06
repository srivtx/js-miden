# Critique & Limitations

## What's Good

1. **Bounding box pre-filter** reduces nearby search from O(n) to O(1) index lookup
2. **Decimal type** for price prevents floating-point rounding errors
3. **Standard amortization formula** is mathematically correct
4. **Prisma type safety** prevents schema mismatches
5. **Take/limit** on search queries prevents unbounded result sets

## What's Missing / Limitations

### 1. No Full-Text Search Index
**Problem:** `ILIKE '%term%'` will degrade linearly with listing count.

**Real-world standard:** Trigram index (pg_trgm) for fuzzy matching or Elasticsearch for advanced search.

**Impact:** Search becomes unusable beyond ~100K listings.

### 2. No PostGIS
**Problem:** Bounding box is an approximation. PostGIS provides true geospatial indexing and complex queries.

**Real-world standard:** PostGIS GIST index with `ST_DWithin`, `ST_Distance`, and KNN queries.

**Impact:** Nearby search includes false positives (listings in bounding box but outside radius).

### 3. No Image Handling
**Problem:** No image upload, storage, or CDN integration.

**Real-world standard:** S3 + CloudFront with WebP conversion and responsive images.

**Impact:** No visual property browsing; poor mobile experience.

### 4. No Search Result Ranking
**Problem:** Results are sorted by `createdAt`, not relevance.

**Real-world standard:** TF-IDF scoring, user behavior signals, and promoted listings.

**Impact:** Users see newest listings first, not most relevant.

### 5. No Mortgage Rate Integration
**Problem:** Mortgage calculator uses user-provided rate, not current market rates.

**Real-world standard:** Integration with Freddie Mac API for daily rate updates.

**Impact:** Buyers get inaccurate payment estimates.

### 6. No Tour Conflict Detection
**Problem:** Two buyers can book tours for the same listing at the same time.

**Real-world standard:** Exclusion constraints or queue-based booking system.

**Impact:** Double-booked tours cause agent confusion.

## Architecture Debt

| Debt Item | Severity | Fix Effort |
|-----------|----------|------------|
| No full-text index | Critical | Medium |
| No PostGIS | High | Medium |
| No image CDN | High | Medium |
| No search ranking | Medium | High |
| No rate API | Medium | Low |
| No tour conflict prevention | Medium | Medium |
| No analytics | Low | High |

## Testing Gaps

1. No load tests for search with 1M+ listings
2. No geospatial edge cases (antimeridian, poles, international)
3. No property-based tests for mortgage calculation edge cases
4. No integration tests for image upload (not implemented)
5. No accessibility tests (WCAG compliance for maps)

## Performance Benchmarks (Projected)

| Metric | Current | Target (Phase 2) |
|--------|---------|------------------|
| Text search (100K listings) | ~500ms | ~50ms (trigram index) |
| Nearby search (100K listings) | ~200ms | ~20ms (PostGIS) |
| Listing creation | ~30ms | ~30ms (unchanged) |
| Tour booking | ~20ms | ~20ms (unchanged) |
| Mortgage calculation | ~1ms | ~1ms (unchanged) |

## Recommended Phase 2 Roadmap

1. Add pg_trgm extension for fuzzy text search
2. Add PostGIS for true geospatial indexing
3. Integrate S3 + CloudFront for image storage
4. Implement Elasticsearch for advanced search (facets, ranking)
5. Add Freddie Mac API for live mortgage rates
6. Build tour booking conflict detection
7. Add analytics pipeline for search behavior
8. Implement AVM (Automated Valuation Model) with ML
