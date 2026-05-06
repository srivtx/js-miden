# v5 — Add Testing (Trading Engine)

## The Scenario

It's 2am. Your junior refactors the matching engine to use a priority queue. "Just moving some logic around," they say. They deploy. Traders report over-fills on resting orders. Your junior stares at the code — it looks fine. But they never tested concurrent matching.

## The PAIN: Silent Breakage on Refactor

From v4:

```typescript
// src/services/matchingEngine.ts
export async function matchOrder(incomingOrder: Order): Promise<Trade[]> {
  const trades: Trade[] = [];
  let remaining = incomingOrder.quantity - incomingOrder.filledQuantity;

  const oppositeSide: OrderSide = incomingOrder.side === 'buy' ? 'sell' : 'buy';
  const candidates = getOrdersBySymbol(incomingOrder.symbol)
    .filter(o => o.side === oppositeSide && o.status !== 'filled' && o.status !== 'cancelled')
    .sort((a, b) => sortByPriceTime(a, b, oppositeSide));

  for (const resting of candidates) {
    if (remaining <= 0) break;
    // ... matching logic
    // BUG: Read-then-write pattern creates a race condition.
    // Two concurrent market orders read the same resting state,
    // then both write fills, over-filling the resting order.
  }

  return trades;
}
```

This code has a **race condition** (read-then-write). Two concurrent market orders read the same resting state. Both calculate fills against the original quantity. The resting order is over-filled.

Without tests, this bug ships to production. Compliance violations follow.

## The Solution: Vitest + Supertest + Mocks

```typescript
// tests/trading.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { resetDb, getTrades } from '../src/db.js';

function makeToken(userId: string) {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'dev-secret');
}

describe('Trading Engine', () => {
  beforeEach(() => resetDb());

  describe('POST /api/orders', () => {
    it('creates a limit order', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${makeToken('u1')}`)
        .send({ symbol: 'AAPL', side: 'buy', type: 'limit', price: 150, quantity: 100 });
      expect(res.status).toBe(201);
      expect(res.body.symbol).toBe('AAPL');
      expect(res.body.status).toBe('open');
    });

    it('rejects negative prices', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${makeToken('u1')}`)
        .send({ symbol: 'AAPL', side: 'buy', type: 'limit', price: -5, quantity: 10 });
      expect(res.status).toBe(400);
    });

    it('rejects sub-penny pricing', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${makeToken('u1')}`)
        .send({ symbol: 'AAPL', side: 'buy', type: 'limit', price: 150.123, quantity: 10 });
      expect(res.status).toBe(400);
    });
  });

  describe('Matching Engine', () => {
    it('matches a market order against a resting limit order', async () => {
      await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${makeToken('seller')}`)
        .send({ symbol: 'AAPL', side: 'sell', type: 'limit', price: 150, quantity: 100 });

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${makeToken('buyer')}`)
        .send({ symbol: 'AAPL', side: 'buy', type: 'market', quantity: 50 });

      expect(res.status).toBe(201);
      expect(res.body.filledQuantity).toBe(50);
      expect(res.body.status).toBe('partially_filled');
    });

    it('BUG: demonstrates over-fill under concurrency', async () => {
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
      // BUG: totalTraded may exceed 100 due to read-then-write race condition
      expect(totalTraded).toBeLessThanOrEqual(100);
    });
  });
});
```

### What testing catches:

| Scenario | Without tests | With tests |
|----------|--------------|------------|
| Refactor breaks price-time priority | Deploy, traders find out | **CI fails** before merge |
| Over-fill under concurrency | Compliance violation | **Test documents** the bug |
| Sub-penny pricing accepted | SEC violation | **Test rejects** invalid prices |
| Validation bypass | Invalid orders enter book | **Test verifies** 400 responses |
| Schema changes | Runtime crashes | **Mock mismatch** alerts you |

## The PAIN of Database Testing

```typescript
// DON'T hit real database in unit tests
// - Slow (100ms+ per test)
// - Flaky (race conditions, state leakage)
// - Requires Docker/CI setup

// DO mock the database layer
// - Fast (<10ms per test)
// - Deterministic
// - Tests YOUR code, not the database
```

Mocking the database means:
- Your tests run in milliseconds
- No database setup required
- You control every response (error cases, empty books, edge cases)

## Testing Evolution in the Trading Engine

| Version | Testing | Confidence |
|---------|---------|------------|
| v1 (JS) | Manual curl | Zero |
| v2 (TS) | Still manual | Zero |
| v3 (Validation) | Still manual | Zero |
| v4 (Logging) | Still manual | Zero |
| v5 (Vitest) | Automated, mocked, fast | High |

## The Realization

> Junior: "I wrote a test for the over-fill race condition. It passes, but the comment says 'BUG'. Now every developer who sees this test knows about the read-then-write problem."
>
> You: "Tests are documentation that executes. A passing test with a 'BUG' comment is better than a wiki page nobody reads. It proves the behavior exists and documents why it's wrong. In a trading engine, one untested refactor can cost millions."

## The Next PAIN

Tests protect your code. But your code runs in a module system from 2009. CommonJS (`require`) is legacy. ESM (`import`) is the 2025 standard. Mixing them causes subtle bugs.

## Next: v6 — Switch to ESM
