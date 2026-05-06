# S24 Wishlist — v1 Simple JS

## The Naive Implementation

You need a wishlist. Simple:

```js
// app.js
const express = require('express');
const app = express();

const wishlist = [];

app.post('/wishlist', (req, res) => {
  wishlist.push(req.body);
  res.json({ status: 'added' });
});

app.get('/wishlist', (req, res) => {
  res.json(wishlist);
});

app.listen(3000);
```

Works locally:
```bash
curl -X POST http://localhost:3000/wishlist \
  -H "Content-Type: application/json" \
  -d '{"userId":"alice","productId":"123","productName":"Widget","price":29.99}'
# → { "status": "added" }

curl http://localhost:3000/wishlist
# → [{ "userId": "alice", "productId": "123", ... }]
```

## The Pain in Production

### 1. In-Memory Data is Ephemeral

Server restarts. Every wishlist is gone. Users add 20 items, come back tomorrow, see an empty list. Trust is destroyed.

### 2. No User Isolation

`GET /wishlist` returns everyone's wishlist. User Alice sees Bob's items. Privacy violation. Data leakage. GDPR nightmare.

### 3. No Deduplication

User adds the same product twice. Three times. The wishlist has 7 copies of the same item. The UI is confusing. Checkout breaks when it tries to add duplicates to the cart.

### 4. No Price Tracking

The product was $29.99 when added. Now it's $19.99. The user has no idea. They missed the sale. Your "price drop alert" feature doesn't exist because you never stored the original price or tracked changes.

### 5. No Sharing

User wants to share their wishlist with family for their birthday. There's no link, no public view, no collaborative list. It's trapped on one device, one session.

## The Lesson

An in-memory array is fine for a prototype. A production wishlist needs persistence, user isolation, deduplication, price tracking, and sharing.

## What v2 Fixes

TypeScript. Before we build a real wishlist, let's get the types right.
