# v1 — The Naive Search (Pure JS)

You need search for your product catalog. You don't have search yet. You just list everything.

```js
const express = require('express');
const app = express();

const products = [
  { id: 1, name: 'Wireless Mouse', category: 'electronics' },
  { id: 2, name: 'Mechanical Keyboard', category: 'electronics' },
  { id: 3, name: 'Coffee Mug', category: 'kitchen' },
];

app.get('/products', (req, res) => {
  res.json(products);
});

app.listen(3000);
```

You GET `/products`. You get everything. Users scroll. It's fine... for 10 products.

## Then the Pain Hits

**No search.** You have 10,000 products. Users want "mouse". They get a list of 10,000 items. They leave.

**No ranking.** You add `SQL LIKE '%mouse%'`. It returns "Wireless Mouse", "Mousepad", "Cat Toy with Mouse Shape". The most relevant result is buried.

**No highlighting.** Users can't see why a result matched. They scan the whole title looking for "mouse".

**No filtering.** A user searches "electronics mouse". You have no way to narrow by category AND name.

## The Realization

You need:
1. **Actual search** — not just listing
2. **Relevance ranking** — best results first
3. **Highlighting** — show what matched
4. **Faceting** — filter by category, price, brand

But search is computationally expensive. The evolution will force you to build indexing services and separate search from ingestion.
