# v1 — Simple JS (Naive Trading Engine)

## The Scenario

It's 2am. Your junior just deployed their first trading engine. "It matches orders!" they say. You ask about concurrency. They blink. You ask about price-time priority. They blink harder.

## The PAIN: In-Memory Arrays

```javascript
// engine.js
const express = require('express');
const app = express();
app.use(express.json());

const orders = []; // <-- Every order lives here. Every bug lives here.
const trades = []; // <-- Every execution lives here. Until restart.

app.post('/orders', (req, res) => {
  const order = {
    id: orders.length + 1,
    symbol: req.body.symbol,
    side: req.body.side,
    price: req.body.price,
    quantity: req.body.quantity,
    filled: 0,
    status: 'open',
  };
  orders.push(order);

  // Naive matching: scan everything
  for (const resting of orders) {
    if (resting.side === order.side) continue;
    if (resting.status !== 'open') continue;
    if (order.side === 'buy' && order.price < resting.price) continue;
    if (order.side === 'sell' && order.price > resting.price) continue;

    const fillQty = Math.min(order.quantity - order.filled, resting.quantity - resting.filled);
    order.filled += fillQty;
    resting.filled += fillQty;
    if (order.filled >= order.quantity) order.status = 'filled';
    if (resting.filled >= resting.quantity) resting.status = 'filled';

    trades.push({
      id: trades.length + 1,
      buyOrderId: order.side === 'buy' ? order.id : resting.id,
      sellOrderId: order.side === 'sell' ? order.id : resting.id,
      price: resting.price,
      quantity: fillQty,
    });
  }

  res.status(201).json(order);
});

app.get('/trades', (_req, res) => res.json(trades));
app.listen(3000);
```

### What breaks in production:

1. **No price-time priority**: The loop scans `orders` in insertion order. A buy order at $150 submitted at 9:00 AM will lose to a buy at $150 submitted at 9:05 AM if the later one happens to match first. Queue-jumping destroys market confidence.

2. **Double-spend under concurrency**: Two market buy orders hit the same sell order simultaneously. Both read `resting.filled = 0`. Both calculate `fillQty = 10`. The sell order is over-filled by 100%.

3. **No order book view**: Clients can't see the depth of market. There's no `/book` endpoint. Traders are flying blind.

4. **ID collisions**: `orders.length + 1` breaks on delete. Cancel order #3, add a new one — duplicate IDs.

5. **Data loss on restart**: The array lives in Node's heap. Deploy a new version? Every open order and every trade vanishes. Regulatory reporting becomes impossible.

### The moment of realization:

> Junior: "Why did two buyers get the same 100 shares? We only had 100 shares for sale."
>
> You: "Because `orders.push` is not atomic. Because `for...of` is not a matching engine. Because RAM is not a ledger."

## Why we start here

This is how every developer builds their first matching logic. It's simple. It works in a demo. And it's completely unsuitable for any market with more than one concurrent user. We keep this version to remember the pain — so we understand why every layer we add exists.

## The fix (next version)

We need types to prevent `req.body.prce` from silently creating orders with `undefined` prices. But more importantly, we need an **order book** — sorted data structures that enforce price-time priority.
