import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { prisma, disconnectDb } from '../src/db.js';

const USER_ID = 'test-user-1';

beforeAll(async () => {
  // Clean up test data
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();

  // Seed test products
  await prisma.product.create({
    data: {
      id: 'prod-1',
      name: 'Test Product',
      sku: 'TEST-001',
      price: 10.00,
      stock: 5,
    },
  });
});

afterAll(async () => {
  await disconnectDb();
});

describe('Cart API', () => {
  it('should add item to cart', async () => {
    const res = await request(app)
      .post('/cart/items')
      .set('x-user-id', USER_ID)
      .send({ productId: 'prod-1', quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.data.quantity).toBe(2);
  });

  it('should get cart with totals', async () => {
    const res = await request(app)
      .get('/cart')
      .set('x-user-id', USER_ID);

    expect(res.status).toBe(200);
    expect(res.body.data.totals.subtotal).toBe(20.00);
    expect(res.body.data.totals.tax).toBe(1.60);
    expect(res.body.data.totals.shipping).toBe(7.00);
  });

  it('should reject adding more than stock', async () => {
    const res = await request(app)
      .post('/cart/items')
      .set('x-user-id', USER_ID)
      .send({ productId: 'prod-1', quantity: 10 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
  });
});

describe('Order API', () => {
  it('should checkout cart and create order', async () => {
    const res = await request(app)
      .post('/orders/checkout')
      .set('x-user-id', USER_ID)
      .send({
        idempotencyKey: 'key-1',
        shippingAddress: { street: '123', city: 'NYC', country: 'USA', postalCode: '10001' },
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('CONFIRMED');
  });

  it('should be idempotent', async () => {
    const res = await request(app)
      .post('/orders/checkout')
      .set('x-user-id', USER_ID)
      .send({
        idempotencyKey: 'key-1',
        shippingAddress: { street: '123', city: 'NYC', country: 'USA', postalCode: '10001' },
      });

    expect(res.status).toBe(201);
  });

  it('should return order history', async () => {
    const res = await request(app)
      .get('/orders')
      .set('x-user-id', USER_ID);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});
