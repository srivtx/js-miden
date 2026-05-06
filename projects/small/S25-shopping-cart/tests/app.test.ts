import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/index.js';

describe('Shopping Cart', () => {
  it('should create a new cart when no cartId provided', async () => {
    const res = await request(app)
      .post('/cart/add')
      .send({
        productId: 'prod-1',
        productName: 'Widget',
        quantity: 2,
        price: 19.99,
      });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.id);
    assert.strictEqual(res.body.items.length, 1);
    assert.strictEqual(res.body.total, 39.98);
  });

  it('should add items to existing cart', async () => {
    const cartRes = await request(app)
      .post('/cart/add')
      .send({
        productId: 'prod-1',
        productName: 'Widget',
        quantity: 1,
        price: 10,
      });

    const cartId = cartRes.body.id;

    const res = await request(app)
      .post('/cart/add')
      .send({
        cartId,
        productId: 'prod-2',
        productName: 'Gadget',
        quantity: 1,
        price: 20,
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.items.length, 2);
    assert.strictEqual(res.body.total, 30);
  });

  it('should merge guest cart on login', async () => {
    const guest = await request(app)
      .post('/cart/add')
      .send({
        productId: 'prod-1',
        productName: 'Widget',
        quantity: 1,
        price: 10,
      });

    const user = await request(app)
      .post('/cart/add')
      .send({
        productId: 'prod-2',
        productName: 'Gadget',
        quantity: 1,
        price: 20,
      });

    const res = await request(app)
      .post('/cart/merge')
      .send({
        guestCartId: guest.body.id,
        userCartId: user.body.id,
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.items.length, 2);
    assert.strictEqual(res.body.total, 30);
  });

  // FAILING TEST: Session fixation — cart ID predictable.
  it('should generate unpredictable cart IDs', async () => {
    const res1 = await request(app)
      .post('/cart/add')
      .send({
        productId: 'prod-1',
        productName: 'Widget',
        quantity: 1,
        price: 10,
      });

    const res2 = await request(app)
      .post('/cart/add')
      .send({
        productId: 'prod-2',
        productName: 'Gadget',
        quantity: 1,
        price: 20,
      });

    const id1 = res1.body.id;
    const id2 = res2.body.id;

    // Cart IDs should not be sequential or predictable
    assert.ok(!id2.startsWith('cart-'), 'Cart IDs should not use predictable sequential format');
    assert.notStrictEqual(id1, id2);
    assert.ok(id1.length >= 16, 'Cart ID should be cryptographically random');
  });

  // FAILING TEST: No expiry — carts accumulate forever.
  it('should expire old carts', async () => {
    const res = await request(app)
      .post('/cart/add')
      .send({
        productId: 'prod-1',
        productName: 'Widget',
        quantity: 1,
        price: 10,
      });

    const cartId = res.body.id;

    // Simulate cleanup
    const { cleanupExpiredCarts } = await import('../src/service.js');
    const cleaned = await cleanupExpiredCarts();

    // Should have cleaned up old carts
    assert.ok(cleaned > 0, 'Should clean up expired carts');

    const getRes = await request(app).get(`/cart/${cartId}`);
    assert.strictEqual(getRes.status, 404, 'Expired cart should not be accessible');
  });
});
