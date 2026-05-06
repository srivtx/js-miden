# MD01 E-Commerce Cart — v1 Simple JS

## The Naive Implementation

You need a shopping cart. Simple:

```js
// cart.js
const express = require('express');
const app = express();
app.use(express.json());

const carts = {}; // userId -> array of items

app.post('/cart/:userId/add', (req, res) => {
  const { userId } = req.params;
  const { productId, quantity } = req.body;

  if (!carts[userId]) carts[userId] = [];
  carts[userId].push({ productId, quantity });

  res.json({ cart: carts[userId] });
});

app.get('/cart/:userId', (req, res) => {
  res.json({ cart: carts[req.params.userId] || [] });
});

app.listen(3000);
```

Works locally:
```bash
curl -X POST http://localhost:3000/cart/user-1/add \
  -H "Content-Type: application/json" \
  -d '{"productId":"shoes-42","quantity":2}'
# → { "cart": [{ "productId": "shoes-42", "quantity": 2 }] }
```

## Then the Pain Hits

### 1. Server Restart = Cart Apocalypse

You deploy a bugfix. The process restarts. `carts` is wiped. Every user sees an empty cart. They rage-quit.

### 2. No Duplication Handling

A user clicks "Add to Cart" twice. You get:
```js
[
  { productId: "shoes-42", quantity: 1 },
  { productId: "shoes-42", quantity: 1 }
]
```

Two line items for the same product. Your checkout calculates shipping per line. The user pays double shipping for one pair of shoes.

### 3. Negative Quantities

A user sends `{"quantity": -5}`. You subtract 5 from... nothing. Your cart now contains a negative quantity. The checkout gives them a refund for items they never bought.

### 4. No Inventory Check

Ten users add the last widget to their cart simultaneously. All ten "succeed." Only one can actually buy it. Nine get an angry email at checkout: "Sorry, out of stock." Cart abandonment spikes.

### 5. Race Conditions

Two requests hit `/cart/user-1/add` at the same millisecond. Node reads `carts['user-1']`, both see an empty array, both push, both write back. One item silently disappears. The user blames you.

## The Realization

An in-memory array is fine for a demo. For an e-commerce cart, you need:

1. **Persistence** — survive restarts
2. **Deduplication** — one line item per SKU
3. **Validation** — no negative quantities, no strings where numbers belong
4. **Inventory awareness** — don't let users cart what doesn't exist
5. **Concurrency safety** — simultaneous updates must not lose data

This is where the evolution starts.
