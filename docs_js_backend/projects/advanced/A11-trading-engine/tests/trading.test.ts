import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { resetDb, getOrders, getTrades } from '../src/db.js';

function makeToken(userId: string) {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'dev-secret');
}

describe('A11 Trading Engine', () => {
  beforeEach(() => {
    resetDb();
  });

  describe('BUG: Race condition in matching', () => {
    it('should not allow two buy orders to over-fill a single sell order', async () => {
      const seller = 'seller-1';
      const buyer1 = 'buyer-1';
      const buyer2 = 'buyer-2';

      // Seller places sell order for 100 units at $10
      await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${makeToken(seller)}`)
        .send({
          symbol: 'AAPL',
          side: 'sell',
          type: 'limit',
          price: 10,
          quantity: 100,
        });

      // Two buyers concurrently place buy orders for 60 units each
      // Total demand = 120, supply = 100
      // One should be partially filled (40 remaining), the other fully filled
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/orders')
          .set('Authorization', `Bearer ${makeToken(buyer1)}`)
          .send({
            symbol: 'AAPL',
            side: 'buy',
            type: 'market',
            quantity: 60,
          }),
        request(app)
          .post('/api/orders')
          .set('Authorization', `Bearer ${makeToken(buyer2)}`)
          .send({
            symbol: 'AAPL',
            side: 'buy',
            type: 'market',
            quantity: 60,
          }),
      ]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);

      const trades = Array.from(getTrades().values());
      const totalTraded = trades.reduce((sum, t) => sum + t.quantity, 0);

      // The sell order only had 100 units. Total traded must not exceed 100.
      // BUG: Without atomic locking, both buyers may see 100 available
      // and create trades totaling 120, over-filling the sell order.
      expect(totalTraded).toBeLessThanOrEqual(100);

      // At least one buyer should be partially or fully filled
      const order1 = getOrders().get(res1.body.id);
      const order2 = getOrders().get(res2.body.id);
      const sellOrder = Array.from(getOrders().values()).find(o => o.userId === seller && o.side === 'sell');

      // Sell order should be fully filled
      expect(sellOrder?.status).toBe('filled');
      expect(sellOrder?.filledQuantity).toBe(100);

      // Combined filled quantity of buyers should equal 100
      const totalBuyerFilled = (order1?.filledQuantity || 0) + (order2?.filledQuantity || 0);
      expect(totalBuyerFilled).toBe(100);
    });
  });

  describe('BUG: No price validation', () => {
    it('should reject orders with negative prices', async () => {
      const user = 'user-1';
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${makeToken(user)}`)
        .send({
          symbol: 'AAPL',
          side: 'buy',
          type: 'limit',
          price: -5,
          quantity: 10,
        });

      // BUG: Negative price is accepted
      expect(res.status).toBe(400);
    });
  });

  describe('Features', () => {
    it('should create a limit order', async () => {
      const user = 'user-1';
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${makeToken(user)}`)
        .send({
          symbol: 'AAPL',
          side: 'buy',
          type: 'limit',
          price: 150,
          quantity: 10,
        });

      expect(res.status).toBe(201);
      expect(res.body.symbol).toBe('AAPL');
      expect(res.body.status).toBe('open');
    });

    it('should match a market buy against a resting sell', async () => {
      const seller = 'seller-1';
      const buyer = 'buyer-1';

      await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${makeToken(seller)}`)
        .send({
          symbol: 'AAPL',
          side: 'sell',
          type: 'limit',
          price: 100,
          quantity: 50,
        });

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${makeToken(buyer)}`)
        .send({
          symbol: 'AAPL',
          side: 'buy',
          type: 'market',
          quantity: 30,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('filled');
      expect(res.body.filledQuantity).toBe(30);
    });

    it('should return trades for a symbol', async () => {
      const seller = 'seller-1';
      const buyer = 'buyer-1';

      await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${makeToken(seller)}`)
        .send({
          symbol: 'TSLA',
          side: 'sell',
          type: 'limit',
          price: 200,
          quantity: 10,
        });

      await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${makeToken(buyer)}`)
        .send({
          symbol: 'TSLA',
          side: 'buy',
          type: 'market',
          quantity: 10,
        });

      const res = await request(app).get('/api/trades/TSLA');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });
});
