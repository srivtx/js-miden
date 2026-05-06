# E06 Distributed Search

Expert-level distributed search engine backend. Implements inverted index, tokenization, stemming, boolean/phrase/fuzzy query parsing, TF-IDF/BM25 ranking, and sharding/replication concepts.

## Bug
Search results leak unauthorized documents because ACL filtering is missing from the search index path.

## Scripts
- `npm run dev` — development with hot reload
- `npm run build` — compile TypeScript
- `npm run start` — run production build
- `npm run test` — run Vitest suite

## Architecture
- `src/routes/search.ts` — HTTP API
- `src/services/indexManager.ts` — index lifecycle, sharding, replication
- `src/services/tokenizer.ts` — tokenization & stemming
- `src/services/queryParser.ts` — query parsing
- `src/services/ranker.ts` — scoring (TF-IDF, BM25)
- `src/services/acl.ts` — access control stub (not wired into search)
- `src/services/searchEngine.ts` — search orchestration
