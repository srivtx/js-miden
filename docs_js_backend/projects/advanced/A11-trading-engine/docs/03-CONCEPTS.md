# A11 Trading Engine: Core Concepts

## WHAT: Order Matching Engine

An order matching engine is a deterministic algorithm that pairs buy orders with sell orders according to pre-defined rules. It is the core of every stock exchange, crypto exchange, and commodities marketplace.

```
┌─────────────────────────────────────────────────────────────┐
│                     ORDER MATCHING ENGINE                    │
├─────────────────────────────────────────────────────────────┤
│  INCOMING ORDER                                              │
│  Buy 60 AAPL @ market                                        │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────────────┐                                         │
│  │  ORDER BOOK     │                                         │
│  │  AAPL           │                                         │
│  │  ─────────────  │                                         │
│  │  BIDS    ASKS   │                                         │
│  │  $150.10 $150.15│ ◀── Match! Price = $150.15             │
│  │  $150.05 $150.20│                                         │
│  │  $150.00 $150.25│                                         │
│  └─────────────────┘                                         │
│       │                                                      │
│       ▼                                                      │
│  TRADE CREATED                                               │
│  Buy 60 AAPL @ $150.15 from Seller                           │
└─────────────────────────────────────────────────────────────┘
```

## WHY: Why This Architecture?

### Why Price-Time Priority?
Because markets need fairness. If a trader submits an order at $150.10 at 9:30:00, and another submits at $150.10 at 9:30:01, the first trader must be filled first. Violating this destroys trust and invites regulatory action.

### Why FIFO Within Price?
Because any other rule (size, random, speed-of-light) creates perverse incentives. Traders would split orders into tiny pieces, co-locate servers in the exchange's data center, or engage in other socially wasteful behaviors.

### Why Atomic Updates?
Because money is not abstract. If two buyers each want 60 shares, and only 100 are for sale, the total traded must be exactly 100. 120 is a bug that costs real money.

## HOW: The Matching Algorithm

```typescript
function matchOrder(incoming: Order): Trade[] {
  const trades: Trade[] = [];
  let remaining = incoming.quantity - incoming.filledQuantity;

  // 1. Get opposite side orders, sorted by priority
  const candidates = getOppositeSide(incoming)
    .filter(o => o.status === 'open' || o.status === 'partially_filled')
    .sort((a, b) => sortByPriceTime(a, b, oppositeSide));

  // 2. Iterate through candidates
  for (const resting of candidates) {
    if (remaining <= 0) break;

    // 3. Check price compatibility
    if (!isPriceCompatible(incoming, resting)) continue;

    // 4. Calculate fill quantity
    const available = resting.quantity - resting.filledQuantity;
    const fillQty = Math.min(remaining, available);

    // 5. ATOMIC CHECK: Is the resting order still available?
    // CORRECT: Use database CAS or advisory lock
    const updated = db.updateWhere(
      `UPDATE orders SET filled_quantity = filled_quantity + ?
       WHERE id = ? AND filled_quantity + ? <= quantity`,
      [fillQty, resting.id, fillQty]
    );

    if (updated.rowCount === 0) {
      // Someone else filled it. Skip to next candidate.
      continue;
    }

    // 6. Create trade
    const trade = createTrade(incoming, resting, fillQty);
    trades.push(trade);

    // 7. Update incoming order
    remaining -= fillQty;
    incoming.filledQuantity += fillQty;
    incoming.status = remaining > 0 ? 'partially_filled' : 'filled';
  }

  return trades;
}
```

## WRONG vs RIGHT

### WRONG: Read-Modify-Write Without Locking
```typescript
// BUG: Race condition
const available = resting.quantity - resting.filledQuantity;
const fillQty = Math.min(remaining, available);
// ... another process changes filledQuantity here ...
resting.filledQuantity += fillQty; // Overwrites the other process's update!
updateOrder(resting);
```

**Why it's wrong**: Between reading `filledQuantity` and writing it back, another matcher can do the same thing. Both see 100 available, both fill 60, and the order ends up with 120 filled.

### RIGHT: Atomic Compare-and-Swap
```typescript
// CORRECT: Database enforces the invariant
const result = await db.query(
  `UPDATE orders
   SET filled_quantity = filled_quantity + $1,
       status = CASE WHEN filled_quantity + $1 >= quantity THEN 'filled' ELSE 'partially_filled' END
   WHERE id = $2 AND filled_quantity + $1 <= quantity
   RETURNING *`,
  [fillQty, resting.id]
);

if (result.rowCount === 0) {
  // Order was already filled or cancelled by another process
  continue;
}
```

**Why it's right**: The database handles concurrency. The `WHERE` clause acts as a guard. If two processes try simultaneously, one succeeds and one gets `rowCount === 0`.

### WRONG: No Price Validation
```typescript
// BUG: Accepts any price
const order = createOrder({ price: input.price ?? 0, ... });
```

### RIGHT: Strict Input Validation
```typescript
if (input.price <= 0 || input.quantity <= 0) {
  throw new ValidationError('Price and quantity must be positive');
}
if (!SYMBOLS.includes(input.symbol)) {
  throw new ValidationError('Unknown symbol');
}
```
