# v3 — Adding Validation

A user just crashed your auction by sending:

```json
{
  "user": "<script>alert('xss')</script>",
  "amount": -500
}
```

Their username renders in the frontend. The negative amount passes your `<= highest` check (it's less than zero). The auction is now poisoned.

## The Fix: Schema Validation

You validate every incoming bid.

```ts
import { z } from 'zod';

const BidSchema = z.object({
  user: z.string().min(1).max(50),
  amount: z.number().positive(),
});

const AuctionSchema = z.object({
  id: z.string().uuid(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});

app.post('/auctions/:id/bid', (req, res) => {
  const parse = BidSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.errors });
  }
  // ...
});
```

Negative amounts are rejected. Empty usernames are rejected. UUID auction IDs are enforced.

## Auction State Validation

You also validate that the auction is still open.

```ts
function isAuctionOpen(auction: Auction): boolean {
  return new Date() < auction.endsAt;
}

if (!isAuctionOpen(auction)) {
  return res.status(400).json({ error: 'Auction closed' });
}
```

## The Bug

You validate the request body, but what about the URL parameter? A user sends a bid to `/auctions/malformed-id/bid`. Your code tries to look it up. No crash, but no consistent error either.

**Fix:** Validate params too.

```ts
const IdParam = z.object({ id: z.string().uuid() });
const { id } = IdParam.parse(req.params);
```

**Next:** Let's add logging so you can trace every bid attempt.
