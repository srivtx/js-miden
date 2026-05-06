import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';

describe('MD16 Food Delivery API', () => {
  let customerId: string;
  let restaurantId: string;
  let driver1Id: string;
  let driver2Id: string;
  let menuItemId: string;

  beforeAll(async () => {
    // Create test data
    const customer = await prisma.user.create({
      data: {
        email: 'customer@test.com',
        password: 'password',
        name: 'Test Customer',
        role: 'CUSTOMER',
      },
    });
    customerId = customer.id;

    const owner = await prisma.user.create({
      data: {
        email: 'owner@test.com',
        password: 'password',
        name: 'Test Owner',
        role: 'RESTAURANT_OWNER',
      },
    });

    const restaurant = await prisma.restaurant.create({
      data: {
        name: 'Test Restaurant',
        address: '123 Test St',
        latitude: 40.7128,
        longitude: -74.0060,
        cuisine: 'Italian',
        ownerId: owner.id,
      },
    });
    restaurantId = restaurant.id;

    const menuItem = await prisma.menu.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Pizza',
        price: 15.99,
        category: 'Main',
        inventory: 5,
        isAvailable: true,
      },
    });
    menuItemId = menuItem.id;

    const driver1 = await prisma.user.create({
      data: {
        email: 'driver1@test.com',
        password: 'password',
        name: 'Driver 1',
        role: 'DRIVER',
      },
    });

    const d1 = await prisma.driver.create({
      data: {
        userId: driver1.id,
        isAvailable: true,
      },
    });
    driver1Id = d1.id;

    const driver2 = await prisma.user.create({
      data: {
        email: 'driver2@test.com',
        password: 'password',
        name: 'Driver 2',
        role: 'DRIVER',
      },
    });

    const d2 = await prisma.driver.create({
      data: {
        userId: driver2.id,
        isAvailable: true,
      },
    });
    driver2Id = d2.id;
  });

  afterAll(async () => {
    await prisma.orderItem.deleteMany();
    await prisma.tracking.deleteMany();
    await prisma.order.deleteMany();
    await prisma.menu.deleteMany();
    await prisma.restaurant.deleteMany();
    await prisma.driver.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Reset orders before each test
    await prisma.orderItem.deleteMany();
    await prisma.tracking.deleteMany();
    await prisma.order.deleteMany();
    
    // Reset drivers
    await prisma.driver.updateMany({
      data: { isAvailable: true, currentOrderId: null },
    });
    
    // Reset menu inventory
    await prisma.menu.update({
      where: { id: menuItemId },
      data: { inventory: 5, isAvailable: true },
    });
  });

  describe('GET /api/restaurants', () => {
    it('should return all restaurants', async () => {
      const res = await request(app).get('/api/restaurants');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/orders', () => {
    it('should create an order', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({
          customerId,
          restaurantId,
          items: [{ menuId: menuItemId, quantity: 2 }],
          address: '456 Test Ave',
          latitude: 40.7580,
          longitude: -73.9855,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.status).toBe('PLACED');
    });

    // BUG TEST: Order creation with sold-out item
    it('BUG: should allow ordering sold-out items (inventory bug)', async () => {
      // Set inventory to 0
      await prisma.menu.update({
        where: { id: menuItemId },
        data: { inventory: 0, isAvailable: false },
      });

      const res = await request(app)
        .post('/api/orders')
        .send({
          customerId,
          restaurantId,
          items: [{ menuId: menuItemId, quantity: 1 }],
          address: '456 Test Ave',
          latitude: 40.7580,
          longitude: -73.9855,
        });

      // This SHOULD fail but doesn't due to the bug
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      console.log('BUG CONFIRMED: Order accepted for sold-out item');
    });
  });

  describe('PATCH /api/orders/:id/assign', () => {
    it('BUG: race condition in driver assignment', async () => {
      // Create an order
      const order = await request(app)
        .post('/api/orders')
        .send({
          customerId,
          restaurantId,
          items: [{ menuId: menuItemId, quantity: 1 }],
          address: '456 Test Ave',
          latitude: 40.7580,
          longitude: -73.9855,
        });

      const orderId = order.body.data.id;

      // Simulate two drivers accepting simultaneously
      const promise1 = request(app)
        .patch(`/api/orders/${orderId}/assign`)
        .send({ driverId: driver1Id });

      const promise2 = request(app)
        .patch(`/api/orders/${orderId}/assign`)
        .send({ driverId: driver2Id });

      const [res1, res2] = await Promise.all([promise1, promise2]);

      // At least one should succeed, but both might succeed due to race condition
      console.log('Driver 1 response:', res1.status, res1.body);
      console.log('Driver 2 response:', res2.status, res2.body);

      // Check the final state
      const finalOrder = await prisma.order.findUnique({
        where: { id: orderId },
      });

      // The bug manifests when both requests succeed but only one driver's assignment persists
      // or when the system allows both to succeed without proper locking
      if (res1.status === 200 && res2.status === 200) {
        console.log('BUG CONFIRMED: Both drivers accepted the same order (race condition)');
      }

      expect(finalOrder).toBeTruthy();
    });
  });

  describe('GET /api/tracking/:orderId', () => {
    it('should get tracking for an order', async () => {
      const order = await request(app)
        .post('/api/orders')
        .send({
          customerId,
          restaurantId,
          items: [{ menuId: menuItemId, quantity: 1 }],
          address: '456 Test Ave',
          latitude: 40.7580,
          longitude: -73.9855,
        });

      const orderId = order.body.data.id;

      const res = await request(app).get(`/api/tracking/${orderId}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
