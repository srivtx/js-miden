# v4 — Adding Logging

A user emails you: "I bid $500 but it didn't register." You check the server. There's no evidence. The bid might have arrived, might have been rejected, might have been lost in a restart. You have no idea.

## The Fix: Structured Logging

You add `pino` and log every bid attempt with context.

```ts
import pino from 'pino';
const logger = pino();

app.post('/auctions/:id/bid', (req, res) => {
  const { id } = req.params;
  const { user, amount } = req.body;

  logger.info({ auctionId: id, user, amount }, 'Bid received');

  const auction = auctions.get(id);
  if (!auction) {
    logger.warn({ auctionId: id }, 'Auction not found');
    return res.status(404).json({ error: 'Auction not found' });
  }

  if (!isAuctionOpen(auction)) {
    logger.info({ auctionId: id, user }, 'Bid rejected: auction closed');
    return res.status(400).json({ error: 'Auction closed' });
  }

  const highest = getHighestBid(auction);
  if (amount <= highest) {
    logger.info({ auctionId: id, user, amount, highest }, 'Bid rejected: too low');
    return res.status(400).json({ error: 'Bid too low' });
  }

  auction.bids.push({ user, amount, time: Date.now() });
  logger.info({ auctionId: id, user, amount }, 'Bid accepted');
  res.json({ status: 'accepted', highest: amount });
});
```

Now you can trace: bid received → auction found → auction open → amount valid → bid accepted.

## Why This Matters

Without logs, debugging production issues is archaeology. With structured logs, you can query: "Show me all bids for auction X by user Y in the last hour."

**Next:** Let's write tests so bid logic stays correct as you evolve.
