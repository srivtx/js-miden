# A11 Trading Engine: Build Guide

## Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Basic understanding of HTTP, JSON, and SQL

## Step 1: Project Setup

```bash
mkdir trading-engine && cd trading-engine
npm init -y
npm install express jsonwebtoken zod
npm install -D typescript vitest supertest @types/express @types/node
npx tsc --init
```

## Step 2: Type Definitions

Create `src/types.ts`:
```typescript
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

## Step 3: Database Layer (In-Memory)

Create `src/db.ts`:
```typescript
const orders = new Map<string, Order>();
const trades = new Map<string, Trade>();

export function createOrder(order: Order): Order {
  orders.set(order.id, order);
  return order;
}

export function getOrdersBySymbol(symbol: string): Order[] {
  return Array.from(orders.values()).filter(o => o.symbol === symbol);
}

export function updateOrder(order: Order): void {
  orders.set(order.id, order);
}

export function createTrade(trade: Trade): void {
  trades.set(trade.id, trade);
}

export function resetDb(): void {
  orders.clear();
  trades.clear();
}
```

## Step 4: Matching Engine (CORRECT Version)

Create `src/services/matchingEngine.ts`:
```typescript
import type { Order, Trade, OrderSide } from '../types.js';
import { getOrdersBySymbol, createTrade, updateOrder } from '../db.js';

function sortByPriceTime(a: Order, b: Order, side: OrderSide): number {
  if (side === 'buy') {
    if (b.price !== a.price) return b.price - a.price;
    return a.createdAt.getTime() - b.createdAt.getTime();
  } else {
    if (a.price !== b.price) return a.price - b.price;
    return a.createdAt.getTime() - b.createdAt.getTime();
  }
}

export async function matchOrder(incomingOrder: Order): Promise<Trade[]> {
  const trades: Trade[] = [];
  let remaining = incomingOrder.quantity - incomingOrder.filledQuantity;

  const oppositeSide: OrderSide = incomingOrder.side === 'buy' ? 'sell' : 'buy';
  const candidates = getOrdersBySymbol(incomingOrder.symbol)
    .filter(o => o.side === oppositeSide && o.status !== 'filled' && o.status !== 'cancelled')
    .sort((a, b) => sortByPriceTime(a, b, oppositeSide));

  for (const resting of candidates) {
    if (remaining <= 0) break;

    // Price validation
    if (incomingOrder.side === 'buy' && incomingOrder.type === 'limit' && incomingOrder.price < resting.price) continue;
    if (incomingOrder.side === 'sell' && incomingOrder.type === 'limit' && incomingOrder.price > resting.price) continue;

    const available = resting.quantity - resting.filledQuantity;
    const fillQty = Math.min(remaining, available);
    if (fillQty <= 0) continue;

    // ATOMIC CHECK (simulated with re-read)
    const currentResting = getOrdersBySymbol(incomingOrder.symbol).find(o => o.id === resting.id);
    if (!currentResting || currentResting.status === 'filled' || currentResting.status === 'cancelled') {
      continue;
    }
    const currentAvailable = currentResting.quantity - currentResting.filledQuantity;
    const actualFill = Math.min(remaining, currentAvailable);
    if (actualFill <= 0) continue;

    const trade: Trade = {
      id: crypto.randomUUID(),
      buyOrderId: incomingOrder.side === 'buy' ? incomingOrder.id : resting.id,
      sellOrderId: incomingOrder.side === 'sell' ? incomingOrder.id : resting.id,
      symbol: incomingOrder.symbol,
      price: resting.price,
      quantity: actualFill,
      createdAt: new Date(),
    };

    createTrade(trade);
    trades.push(trade);

    incomingOrder.filledQuantity += actualFill;
    incomingOrder.status = incomingOrder.filledQuantity >= incomingOrder.quantity ? 'filled' : 'partially_filled';

    resting.filledQuantity += actualFill;
    resting.status = resting.filledQuantity >= resting.quantity ? 'filled' : 'partially_filled';
    updateOrder(resting);

    remaining -= actualFill;
  }

  return trades;
}
```

## Step 5: Routes with Validation

Create `src/routes/orders.ts`:
```typescript
import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { createOrder, getOrdersBySymbol, getOrderById, updateOrder } from '../db.js';
import { matchOrder } from '../services/matchingEngine.js';
import type { CreateOrderInput } from '../types.js';

const router = Router();

router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  const input = req.body as CreateOrderInput;
  const userId = req.userId!;

  // VALIDATION
  if (!input.symbol || !input.side || !input.type || !input.quantity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (input.quantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be positive' });
  }
  if (input.type === 'limit' && (input.price === undefined || input.price <= 0)) {
    return res.status(400).json({ error: 'Limit orders require a positive price' });
  }

  const order = createOrder({
    id: crypto.randomUUID(),
    userId, symbol: input.symbol, side: input.side, type: input.type,
    price: input.price ?? 0, quantity: input.quantity,
    filledQuantity: 0, status: 'open', createdAt: new Date(),
  });

  if (order.type === 'market' || order.status === 'open') {
    await matchOrder(order);
    updateOrder(order);
  }

  res.status(201).json(order);
});

export { router as ordersRouter };
```

## Step 6: Testing

Create `tests/trading.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { resetDb, getOrders, getTrades } from '../src/db.js';

function makeToken(userId: string) {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'dev-secret');
}

describe('Trading Engine', () => {
  beforeEach(() => resetDb());

  it('should reject negative prices', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${makeToken('u1')}`)
      .send({ symbol: 'AAPL', side: 'buy', type: 'limit', price: -5, quantity: 10 });
    expect(res.status).toBe(400);
  });

  it('should not over-fill resting orders under concurrency', async () => {
    const seller = 'seller-1';
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${makeToken(seller)}`)
      .send({ symbol: 'AAPL', side: 'sell', type: 'limit', price: 10, quantity: 100 });

    const [res1, res2] = await Promise.all([
      request(app).post('/api/orders').set('Authorization', `Bearer ${makeToken('b1')}`)
        .send({ symbol: 'AAPL', side: 'buy', type: 'market', quantity: 60 }),
      request(app).post('/api/orders').set('Authorization', `Bearer ${makeToken('b2')}`)
        .send({ symbol: 'AAPL', side: 'buy', type: 'market', quantity: 60 }),
    ]);

    const totalTraded = Array.from(getTrades().values()).reduce((s, t) => s + t.quantity, 0);
    expect(totalTraded).toBeLessThanOrEqual(100);
  });
});
```

## Step 7: Run

```bash
npx vitest
```
