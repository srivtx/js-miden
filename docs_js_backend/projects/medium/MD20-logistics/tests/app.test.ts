import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';

describe('MD20 Logistics API', () => {
  let userId: string;
  let warehouseAId: string;
  let warehouseBId: string;
  let warehouseCId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: 'operator@test.com',
        password: 'password',
        name: 'Test Operator',
        role: 'OPERATOR',
      },
    });
    userId = user.id;

    const whA = await prisma.warehouse.create({
      data: {
        name: 'Warehouse A',
        address: '100 Industrial Blvd',
        city: 'Chicago',
        country: 'USA',
        latitude: 41.8781,
        longitude: -87.6298,
        capacity: 5000,
      },
    });
    warehouseAId = whA.id;

    const whB = await prisma.warehouse.create({
      data: {
        name: 'Warehouse B',
        address: '200 Commerce St',
        city: 'Detroit',
        country: 'USA',
        latitude: 42.3314,
        longitude: -83.0458,
        capacity: 3000,
      },
    });
    warehouseBId = whB.id;

    const whC = await prisma.warehouse.create({
      data: {
        name: 'Warehouse C',
        address: '300 Shipping Lane',
        city: 'Indianapolis',
        country: 'USA',
        latitude: 39.7684,
        longitude: -86.1581,
        capacity: 4000,
      },
    });
    warehouseCId = whC.id;
  });

  afterAll(async () => {
    await prisma.routeNode.deleteMany();
    await prisma.route.deleteMany();
    await prisma.tracking.deleteMany();
    await prisma.shipment.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.warehouse.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.routeNode.deleteMany();
    await prisma.route.deleteMany();
    await prisma.tracking.deleteMany();
    await prisma.shipment.deleteMany();
  });

  describe('POST /api/shipments', () => {
    it('should create a shipment', async () => {
      const res = await request(app)
        .post('/api/shipments')
        .send({
          originId: warehouseAId,
          destinationId: warehouseBId,
          weight: 50.5,
          createdBy: userId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.trackingNumber).toBeTruthy();
    });
  });

  describe('PATCH /api/shipments/:id/status', () => {
    it('BUG: eventual consistency between shipment and tracking', async () => {
      const shipment = await request(app)
        .post('/api/shipments')
        .send({
          originId: warehouseAId,
          destinationId: warehouseBId,
          weight: 50.5,
          createdBy: userId,
        });

      const shipmentId = shipment.body.data.id;

      // Update status to IN_TRANSIT
      const updateRes = await request(app)
        .patch(`/api/shipments/${shipmentId}/status`)
        .send({ status: 'IN_TRANSIT' });

      expect(updateRes.status).toBe(200);

      // Check tracking - should match shipment status
      const trackingRes = await request(app).get(`/api/tracking/${shipmentId}`);
      const latestTracking = trackingRes.body.data[0];

      // If tracking creation failed, these won't match
      console.log('Shipment status:', updateRes.body.data.status);
      console.log('Latest tracking status:', latestTracking?.status);

      if (latestTracking?.status !== 'IN_TRANSIT') {
        console.log('BUG CONFIRMED: Shipment and tracking status are inconsistent');
      }

      expect(trackingRes.status).toBe(200);
    });
  });

  describe('POST /api/routes', () => {
    it('BUG: circular route created by routing algorithm', async () => {
      const shipment = await request(app)
        .post('/api/shipments')
        .send({
          originId: warehouseAId,
          destinationId: warehouseCId,
          weight: 50.5,
          createdBy: userId,
        });

      const shipmentId = shipment.body.data.id;

      // Create a route
      const routeRes = await request(app)
        .post('/api/routes')
        .send({ shipmentId });

      expect(routeRes.status).toBe(201);

      const route = routeRes.body.data;
      const nodes = route.nodes;

      console.log('Route nodes:', nodes.map((n: any) => n.warehouse.name));

      // Check for circular routes (same warehouse appearing multiple times)
      const warehouseIds = nodes.map((n: any) => n.warehouseId);
      const uniqueIds = new Set(warehouseIds);

      if (warehouseIds.length !== uniqueIds.size) {
        console.log('BUG CONFIRMED: Circular route detected - same warehouse visited multiple times');
      }

      expect(route).toHaveProperty('id');
    });
  });

  describe('GET /api/warehouses', () => {
    it('should return all warehouses', async () => {
      const res = await request(app).get('/api/warehouses');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('GET /api/inventory/:warehouseId', () => {
    it('should get warehouse inventory', async () => {
      // Add some inventory
      await prisma.inventory.create({
        data: {
          warehouseId: warehouseAId,
          sku: 'ITEM-001',
          quantity: 100,
        },
      });

      const res = await request(app).get(`/api/inventory/${warehouseAId}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
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
