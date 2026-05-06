import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { resetDb, auctions, bids } from '../src/db.js';

describe('A01 Auction', () => {
  beforeEach(() => {
    resetDb();
  });

  async function createUser(username: string, email: string) {
    // Simplified - in real app this would be auth endpoint
    return { id: crypto.randomUUID(), username, email };
  }

  async function createAuction(token: string, overrides = {}) {
    const future = new Date(Date.now() + 3600000);
    const res = await request(app)
      .post('/api/auctions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Test Auction',
        description: 'Test',
        startingPrice: 100,
        endsAt: future.toISOString(),
        ...overrides,
      });
    return res.body;
  }

  // Simple token generation for tests
  function makeToken(userId: string) {
    const jwt = require('jsonwebtoken');
    return jwt.sign({ userId }, process.env.JWT_SECRET || 'dev-secret');
  }

  describe('BUG: Race condition in bidding', () => {
    it('should not allow lower bid to win over higher concurrent bid', async () => {
      const user1 = await createUser('alice', 'alice@test.com');
      const user2 = await createUser('bob', 'bob@test.com');
      const token1 = makeToken(user1.id);
      const token2 = makeToken(user2.id);
      
      const auction = await createAuction(token1);
      
      // Both users read current price (100) and decide to bid
      // User 1 bids 150, User 2 bids 200 concurrently
      const [bid1Res, bid2Res] = await Promise.all([
        request(app)
          .post(`/api/auctions/${auction.id}/bids`)
          .set('Authorization', `Bearer ${token1}`)
          .send({ amount: 150 }),
        request(app)
          .post(`/api/auctions/${auction.id}/bids`)
          .set('Authorization', `Bearer ${token2}`)
          .send({ amount: 200 }),
      ]);
      
      expect(bid1Res.status).toBe(201);
      expect(bid2Res.status).toBe(201);
      
      // Check final state
      const final = await request(app).get(`/api/auctions/${auction.id}`);
      
      // BUG: Race condition means the last write wins, not the highest bid
      expect(final.body.auction.currentPrice).toBe(200);
      expect(final.body.auction.highestBidderId).toBe(user2.id);
    });
  });

  describe('BUG: No bid validation', () => {
    it('should reject bids lower than current highest bid', async () => {
      const user1 = await createUser('alice', 'alice@test.com');
      const user2 = await createUser('bob', 'bob@test.com');
      const token1 = makeToken(user1.id);
      const token2 = makeToken(user2.id);
      
      const auction = await createAuction(token1);
      
      // User 1 bids 200
      await request(app)
        .post(`/api/auctions/${auction.id}/bids`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ amount: 200 });
      
      // User 2 tries to bid 150 (lower than 200)
      const res = await request(app)
        .post(`/api/auctions/${auction.id}/bids`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ amount: 150 });
      
      // BUG: Should reject this bid but currently accepts it
      expect(res.status).toBe(400);
    });
  });

  describe('Features', () => {
    it('should create an auction', async () => {
      const user = await createUser('alice', 'alice@test.com');
      const token = makeToken(user.id);
      
      const auction = await createAuction(token);
      expect(auction.title).toBe('Test Auction');
      expect(auction.startingPrice).toBe(100);
    });

    it('should place a valid bid', async () => {
      const user = await createUser('alice', 'alice@test.com');
      const token = makeToken(user.id);
      
      const auction = await createAuction(token);
      
      const bid = await request(app)
        .post(`/api/auctions/${auction.id}/bids`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 150 });
      
      expect(bid.status).toBe(201);
      expect(bid.body.amount).toBe(150);
    });
  });
});
