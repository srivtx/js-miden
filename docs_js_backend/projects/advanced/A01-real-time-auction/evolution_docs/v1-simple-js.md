# v1 — The Naive Auction (Pure JS Monolith)

You need a real-time auction. Bidders POST their offers. Highest bid wins.

```js
const express = require('express');
const app = express();
app.use(express.json());

const auctions = new Map();

app.post('/auctions/:id/bid', (req, res) => {
  const { id } = req.params;
  const { user, amount } = req.body;

  if (!auctions.has(id)) {
    auctions.set(id, { bids: [] });
  }

  const auction = auctions.get(id);
  const highest = auction.bids.length
    ? Math.max(...auction.bids.map((b) => b.amount))
    : 0;

  if (amount <= highest) {
    return res.status(400).json({ error: 'Bid too low' });
  }

  auction.bids.push({ user, amount, time: Date.now() });
  res.json({ status: 'accepted', highest: amount });
});

app.get('/auctions/:id', (req, res) => {
  res.json(auctions.get(req.params.id) || { bids: [] });
});

app.listen(3000);
```

You POST a bid. You GET the state. Simple.

## Then the Pain Hits

**Race conditions.** Two users bid $100 at the same time. Both read `highest = 90`. Both pass the check. Both write. Now you have two $100 bids and no clear winner.

**No real-time updates.** The winner refreshes the page every 2 seconds to see if they were outbid. Your server gets hammered with polling requests.

**No bid history.** A user claims they bid $150. You have no log of it. The `bids` array is the only source of truth, and you just restarted the server. It's gone.

**No anti-sniping.** An auction ends at 3:00:00 PM. At 2:59:59 PM, a sniper bids $50. The previous high bidder has no time to respond. Fairness is gone.

## The Realization

You need:
1. **Atomic bid processing** — no race conditions
2. **WebSocket push** — real-time updates to all clients
3. **Persistent bid history** — durable record of every bid
4. **Anti-sniping logic** — extend auction time on last-second bids

But this is a monolith. Every feature piles into one process. The evolution will force you to split services.
