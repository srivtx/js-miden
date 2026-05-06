import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/index.js';

describe('Wishlist', () => {
  it('should add an item to wishlist', async () => {
    const res = await request(app)
      .post('/wishlist')
      .send({
        userId: 'user-1',
        productId: 'prod-1',
        productName: 'Blue Widget',
        price: 29.99,
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.productName, 'Blue Widget');
  });

  it('should remove an item from wishlist', async () => {
    const addRes = await request(app)
      .post('/wishlist')
      .send({
        userId: 'user-1',
        productId: 'prod-1',
        productName: 'Blue Widget',
        price: 29.99,
      });

    const res = await request(app).delete(`/wishlist/user-1/${addRes.body.id}`);
    assert.strictEqual(res.status, 204);
  });

  // FAILING TEST: No deduplication — same item added twice.
  it('should not allow duplicate items', async () => {
    await request(app)
      .post('/wishlist')
      .send({
        userId: 'user-1',
        productId: 'prod-dup',
        productName: 'Duplicate Item',
        price: 19.99,
      });

    const res = await request(app)
      .post('/wishlist')
      .send({
        userId: 'user-1',
        productId: 'prod-dup',
        productName: 'Duplicate Item',
        price: 19.99,
      });

    assert.strictEqual(res.status, 409, 'Should reject duplicate item');

    const listRes = await request(app).get('/wishlist/user-1');
    const duplicates = listRes.body.filter((item: { productId: string }) => item.productId === 'prod-dup');
    assert.strictEqual(duplicates.length, 1, 'Should only have one instance of each product');
  });

  // FAILING TEST: No user isolation — user A sees user B's wishlist.
  it('should isolate wishlists by user', async () => {
    await request(app)
      .post('/wishlist')
      .send({
        userId: 'user-a',
        productId: 'prod-a',
        productName: 'Item A',
        price: 10,
      });

    await request(app)
      .post('/wishlist')
      .send({
        userId: 'user-b',
        productId: 'prod-b',
        productName: 'Item B',
        price: 20,
      });

    const res = await request(app).get('/wishlist/user-a');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 1);
    assert.strictEqual(res.body[0].productId, 'prod-a', 'User A should only see their own items');
  });
});
