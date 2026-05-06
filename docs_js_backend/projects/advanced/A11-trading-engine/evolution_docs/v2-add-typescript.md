# v2 — Add TypeScript (Trading Engine)

## The Scenario

It's 2am. Your junior just spent 4 hours debugging why an order has `prce` instead of `price`. "JavaScript doesn't care," they mutter. The matching engine matched an order at `undefined` dollars. You hand them TypeScript.

## The PAIN: Dynamic Typing in a Financial System

From v1, we had this bug:

```javascript
app.post('/orders', (req, res) => {
  const order = {
    id: orders.length + 1,
    price: req.body.prce, // <-- typo. JavaScript: "undefined? sure."
    quantity: req.body.quantity,
  };
});
```

This compiles. Runs. Stores `undefined` as the price. The matching engine tries to compare `undefined < 150` and produces `false` for every check. The order never fills. The trader stares at an open order for hours.

### More typos that bite you:

```javascript
// Wrong property access
order.filledQty // undefined (real property is 'filledQuantity')

// Wrong side string
order.side = 'biy' // No error. Just an order that never matches.

// ID as string vs number
orders.find(o => o.id === req.params.id) // "3" !== 3, always undefined
```

These runtime errors happen in production. Traders see stuck orders. You see compliance violations. At 2am.

## The Solution: TypeScript

```typescript
// src/types.ts
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'limit' | 'market';
export type OrderStatus = 'open' | 'partially_filled' | 'filled' | 'cancelled';

export interface Order {
  id: string;
  userId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: number;
  quantity: number;
  filledQuantity: number;
  status: OrderStatus;
  createdAt: Date;
}

export interface Trade {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  symbol: string;
  price: number;
  quantity: number;
  createdAt: Date;
}
```

```typescript
// src/routes/orders.ts
import type { Order, CreateOrderInput } from '../types.js';

app.post('/orders', (req: Request, res: Response) => {
  const input: CreateOrderInput = req.body;
  // ^ TypeScript knows 'price' is required, 'prce' is an error

  const order: Order = {
    id: crypto.randomUUID(),
    userId: req.userId!,
    symbol: input.symbol,
    side: input.side,
    type: input.type,
    price: input.price,
    quantity: input.quantity,
    filledQuantity: 0,
    status: 'open',
    createdAt: new Date(),
  };

  orders.push(order);
  res.status(201).json(order);
});
```

### What TypeScript catches at compile time:

| Bug | JavaScript | TypeScript |
|-----|-----------|------------|
| `req.body.prce` | Runtime `undefined` | **Compile error**: Property 'prce' does not exist |
| `order.filledQty` | Runtime `undefined` | **Compile error**: Property 'filledQty' does not exist |
| `side: 'biy'` | Runtime accepted | **Compile error**: Type '"biy"' not assignable to 'OrderSide' |
| `id: orders.length + 1` | Works, but string/number mismatch later | **Type error**: Type 'number' not assignable to 'string' |
| Missing `filledQuantity` | Runtime `undefined` | **Compile error**: Property 'filledQuantity' is missing |

## The New PAIN: Any Types

```typescript
// The lazy way (DON'T DO THIS)
app.post('/orders', (req: Request, res: Response) => {
  const order = req.body as any; // "I don't care about types"
  orders.push(order); // accepts literally anything
});
```

Using `as any` defeats the purpose. It's like wearing a seatbelt but unbuckling it before the crash.

## The Realization

> Junior: "The red squiggly line caught `req.body.prce` before I deployed. That typo would have created an unmatchable order."
>
> You: "That's not a bug — that's TypeScript doing its job. The real bug was the 12 other typos you already fixed before commit. In a trading engine, a typo can cost real money."

## Why this matters for the Trading Engine

Our data model is complex and evolving:
- v1: `{ id, symbol, side, price, quantity, filled, status }`
- v2: `{ id, userId, symbol, side, type, price, quantity, filledQuantity, status, createdAt }`

Without types, you add `userId` to the create endpoint but forget it in the matching engine. With types, the compiler reminds you: *"Hey, Order.userId exists, but your matchOrder function ignores it."*

But TypeScript only catches **developer** bugs. It does nothing when a **user** sends `{ price: -5 }` or `{ quantity: 0 }`. For that, we need validation.

## Next: v3 — Add Validation
