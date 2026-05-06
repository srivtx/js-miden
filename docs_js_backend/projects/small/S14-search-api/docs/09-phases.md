# Phases

## Phase 1: MVP

- [x] `POST /index` stores documents
- [x] `GET /search?q=...` returns matching documents
- [x] PostgreSQL `tsvector` for full-text search
- [x] Basic relevance ranking

## Phase 2: Enhancements

- [x] Stemming support (`run` → `running`, `runners`)
- [x] Pagination (`page`, `limit`)
- [x] Highlighting with `ts_headline`
- [x] Rank-based sorting with `ts_rank_cd`

## Phase 3: Advanced

- [ ] Phrase search with proximity operators
- [ ] Faceted search (filter by category/date)
- [ ] Search suggestion / autocomplete
- [ ] Multi-language support (different text search configurations)
- [ ] Relevance tuning (weights for title vs content)

## Known Bugs (Intentional)

1. `/search-slow` uses `ILIKE` — slow on large data
2. `/search-unsafe` concatenates user input — SQL injection risk
3. Missing index scenario documented in schema (B-tree vs GIN)
