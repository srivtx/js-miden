# v7 — Production Setup (Inverted Index + BM25 + Faceting)

Your search works. But `ILIKE '%word%'` is O(n) over all products. At 100,000 products, searches take 5 seconds. You need real search infrastructure.

---

## Architecture Evolution: No Search → SQL LIKE → Inverted Index + Services

```
No Search (v1)
    ↓
SQL LIKE (v2-v5)
    ↓
Inverted Index (v7)
    ↓
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Indexer   │────▶│   Search    │◀────│   Search    │
│   Service   │     │   Index     │     │   API       │
└─────────────┘     └─────────────┘     └─────────────┘
        │                                      │
        └──────────────▶ DB ◀──────────────────┘
```

---

## Pain #1: SQL LIKE Is Too Slow

`SELECT * FROM products WHERE name ILIKE '%mouse%'` scans the entire table. No index helps because of the leading wildcard. At scale, it's unusable.

**Fix:** Inverted index.

```ts
// indexer-service/src/index.ts
import { Document } from 'flexsearch';

const index = new Document({
  document: {
    id: 'id',
    index: ['name', 'description', 'category'],
  },
});

// Index all products on startup
const products = await db.selectFrom('products').selectAll().execute();
for (const product of products) {
  index.add(product);
}

// Watch for DB changes and re-index
setInterval(async () => {
  const changed = await db
    .selectFrom('products')
    .where('updated_at', '>', lastSync)
    .selectAll()
    .execute();
  for (const product of changed) {
    index.update(product);
  }
  lastSync = new Date();
}, 5000);
```

Now "mouse" points directly to product IDs [1, 2, 3]. No table scan.

---

## Pain #2: No Relevance Ranking

Inverted index finds matches, but "Wireless Mouse" and "Cat Toy with Mouse Shape" have equal weight. Users want the most relevant first.

**Fix:** BM25 scoring.

```ts
// search-service/src/bm25.ts
function bm25Score(
  term: string,
  doc: Product,
  docsContainingTerm: number,
  totalDocs: number,
  avgDocLength: number,
  k1 = 1.5,
  b = 0.75
): number {
  const tf = countOccurrences(term, doc.name + ' ' + doc.description);
  const docLength = (doc.name + ' ' + doc.description).split(/\s+/).length;
  const idf = Math.log(1 + (totalDocs - docsContainingTerm + 0.5) / (docsContainingTerm + 0.5));

  const normalizedTf = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLength / avgDocLength)));

  return idf * normalizedTf;
}

// search-service/src/search.ts
export function search(query: string, products: Product[]): ScoredProduct[] {
  const terms = query.toLowerCase().split(/\s+/);
  const scored = products.map((product) => {
    let score = 0;
    for (const term of terms) {
      const docsWithTerm = countDocsWithTerm(term); // from inverted index
      score += bm25Score(term, product, docsWithTerm, products.length, avgDocLength);
    }
    return { ...product, score };
  });

  return scored.sort((a, b) => b.score - a.score);
}
```

BM25 considers term frequency, document length, and inverse document frequency. "Wireless Mouse" scores higher than "Cat Toy with Mouse Shape" for the query "mouse".

---

## Pain #3: Users Can't See Why Results Matched

Search returns "Wireless Mouse" but the user scans the whole title looking for "mouse". It's a bad experience.

**Fix:** Highlighting.

```ts
// search-service/src/highlight.ts
export function highlight(text: string, query: string): string {
  const terms = query.toLowerCase().split(/\s+/);
  let highlighted = text;

  for (const term of terms) {
    const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark>$1</mark>');
  }

  return highlighted;
}

// In search response
const results = search(query, products).map((r) => ({
  ...r,
  highlightedName: highlight(r.name, query),
  highlightedDescription: highlight(r.description, query),
}));
```

Users immediately see `<mark>mouse</mark>` in the results.

---

## Pain #4: No Filtering by Category/Price/Brand

A user searches "mouse". They want electronics only. Your search returns kitchen mice, pet mice, and computer mice.

**Fix:** Faceting.

```ts
// search-service/src/facets.ts
interface FacetCounts {
  category: Record<string, number>;
  priceRange: Record<string, number>;
}

function computeFacets(results: Product[]): FacetCounts {
  const facets: FacetCounts = { category: {}, priceRange: {} };

  for (const product of results) {
    facets.category[product.category] = (facets.category[product.category] || 0) + 1;

    const range = getPriceRange(product.price);
    facets.priceRange[range] = (facets.priceRange[range] || 0) + 1;
  }

  return facets;
}

// search-service/src/search.ts
app.get('/search', async (req, res) => {
  const { q, category, minPrice, maxPrice } = req.query;

  let results = await fetchProductsFromIndex(q as string);

  // Apply facet filters
  if (category) results = results.filter((r) => r.category === category);
  if (minPrice) results = results.filter((r) => r.price >= Number(minPrice));
  if (maxPrice) results = results.filter((r) => r.price <= Number(maxPrice));

  const facets = computeFacets(results);

  res.json({
    results: results.slice(0, 20),
    facets,
    total: results.length,
  });
});
```

The response includes:
```json
{
  "results": [...],
  "facets": {
    "category": { "electronics": 15, "accessories": 8, "pets": 2 }
  }
}
```

Users can filter by category and see counts before clicking.

---

## Pain #5: Index and Search Coupled

The indexer runs in the same process as the search API. Re-indexing blocks search requests. Users see latency spikes.

**Fix:** Separate Indexer Service and Search Service.

```ts
// indexer-service: rebuilds index, writes to shared Redis/Elasticsearch
// search-service: reads index, serves queries

// search-service/src/index.ts
import express from 'express';
import { loadIndex } from './index-loader.js';

const app = express();
const index = await loadIndex(); // load from Redis or file snapshot

app.get('/search', async (req, res) => {
  const results = search(req.query.q as string, index);
  res.json(results);
});

// Hot-reload index without restart
setInterval(async () => {
  const newIndex = await loadIndex();
  // Atomic swap
  globalIndex = newIndex;
}, 30000);
```

Indexer rebuilds in the background. Search API atomically swaps indexes. Zero downtime.

---

## Final Checklist

- [ ] Inverted index: O(1) term lookup, no table scans
- [ ] BM25 scoring: relevance-ranked results
- [ ] Highlighting: `<mark>` matched terms in results
- [ ] Faceting: filter counts by category, price, brand
- [ ] Service split: indexer vs search API scale independently
- [ ] Hot index reload: zero-downtime index updates
- [ ] Query validation: sanitize input, prevent ReDoS
- [ ] Search logging: track queries, latency, zero-result rates
- [ ] Environment-based config: index path, refresh interval

This is a production search engine. It started as a naive product list. Now it has inverted indexing, BM25 relevance, highlighting, faceting, and a service-oriented architecture.
