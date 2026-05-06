# v1-simple-js

## Goal
Get a shopping cart running in pure JavaScript with zero dependencies beyond Express.

## Code

```js
// src/index.js
const express = require('express');
const app = express();
app.use(express.json());

const cartStore = new Map();
let cartCounter = 0;

app.post('/cart/add', (req, res) => {
  const { productId, quantity, price } = req.body;
  const cartId = `cart-${++cartCounter}`;
  const cart = { id: cartId, items: [{ productId, quantity, price }], total: quantity * price };
  cartStore.set(cartId, cart);
  res.json(cart);
});

app.get('/cart/:id', (req, res) => {
  const cart = cartStore.get(req.params.id);
  if (!cart) return res.status(404).json({ error: 'Not found' });
  res.json(cart);
});

app.listen(3000, () => console.log('Cart on 3000'));
```

## Decisions
- **In-memory Map**: Fastest possible iteration. No DB setup friction.
- **Sequential IDs**: Simplest debugging — you know `cart-3` was created after `cart-2`.

## Risks
- Cart IDs are predictable (enumeration attack).
- Process restart wipes all carts.
- No item updates — only single-add.
