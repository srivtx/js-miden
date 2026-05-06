# v2 — Adding TypeScript

You just spent 3 hours debugging why a bid amount of `"100"` (string) passed the `amount <= highest` check against `highest = 90` (number).

```js
if (amount <= highest) {
  return res.status(400).json({ error: 'Bid too low' });
}
```

`"100" <= 90` is `false` in JavaScript (string comparison: `"1"` < `"9"`). The string bid was accepted even though it was lower. TypeScript would have screamed.

## The Fix: Types

```ts
interface Bid {
  user: string;
  amount: number;
  time: number;
}

interface Auction {
  id: string;
  bids: Bid[];
  endsAt: Date;
}

app.post('/auctions/:id/bid', (req, res) => {
  const { user, amount }: { user: string; amount: number } = req.body;
  // ...
});
```

Now `amount` is enforced as a number at compile time. No more string/number confusion.

## But Wait...

TypeScript doesn't fix the race condition. Two typed `number` bids of `100` still race. It doesn't add WebSockets. It just makes the code type-safe.

**Next:** Let's add validation so malformed bids are rejected before they touch the auction state.
