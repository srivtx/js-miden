# v5 — Adding Testing

You "improved" search by adding `ILIKE '%word%'` for every word in the query. A user searches "wireless mouse". You split into `ILIKE '%wireless%'` AND `ILIKE '%mouse%'`. It works. But a user searches "mouse wireless". The order shouldn't matter... but your test would have caught if it did.

Wait — you have no tests for search relevance.

## The Fix: Automated Tests

```ts
import { describe, it, expect } from 'vitest';
import { searchProducts } from '../src/search.js';

const products: Product[] = [
  { id: 1, name: 'Wireless Mouse', category: 'electronics' },
  { id: 2, name: 'Wired Mouse', category: 'electronics' },
  { id: 3, name: 'Mousepad', category: 'accessories' },
  { id: 4, name: 'Wireless Keyboard', category: 'electronics' },
];

describe('Product Search', () => {
  it('finds products by name', () => {
    const results = searchProducts(products, 'mouse');
    expect(results.map((r) => r.name)).toContain('Wireless Mouse');
    expect(results.map((r) => r.name)).toContain('Wired Mouse');
  });

  it('is case-insensitive', () => {
    const lower = searchProducts(products, 'mouse');
    const upper = searchProducts(products, 'MOUSE');
    expect(lower).toEqual(upper);
  });

  it('filters by category', () => {
    const results = searchProducts(products, 'mouse', { category: 'electronics' });
    expect(results.every((r) => r.category === 'electronics')).toBe(true);
    expect(results.map((r) => r.name)).not.toContain('Mousepad');
  });

  it('returns empty array for no matches', () => {
    const results = searchProducts(products, 'spaceship');
    expect(results).toEqual([]);
  });

  it('ranks exact matches higher', () => {
    const results = searchProducts(products, 'wireless mouse');
    expect(results[0].name).toBe('Wireless Mouse');
  });
});
```

## What Tests Caught

- Case sensitivity regression → caught
- Category filter breakage → caught
- Empty result handling → caught
- Ranking correctness → caught

## The Confidence

Now you can swap `ILIKE` for an inverted index, add BM25 scoring, or implement faceting and know that basic search invariants hold.

**Next:** Let's switch to ESM before building the indexing service.
